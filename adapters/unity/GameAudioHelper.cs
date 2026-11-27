using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Lightweight Unity audio playback helper supporting 3-variant WAV pools,
/// round-robin cycling with per-play pitch variation, 3D positional attenuation,
/// and live-updatable RPM/weather loops that preserve per-play pitch variation.
/// </summary>
public sealed class GameAudioHelper : MonoBehaviour
{
    /// Map a Lumina scene position or forward vector into Unity's +Z-forward world.
    public static Vector3 FromSceneVector(Vector3 vector)
    {
        return new Vector3(vector.x, vector.y, -vector.z);
    }

    /// Call on a game-owned voice. Set position/facing using FromSceneVector on the world pose.
    public static void ConfigureSceneVoice(AudioSource voice, bool listenerLocked, float referenceMetres,
        float spread, bool doppler)
    {
        voice.spatialBlend = listenerLocked ? 0f : 1f;
        voice.minDistance = Mathf.Max(0.01f, referenceMetres);
        voice.maxDistance = Mathf.Max(voice.minDistance, voice.maxDistance);
        voice.rolloffMode = AudioRolloffMode.Logarithmic;
        voice.spread = 180f * Mathf.Clamp01(spread);
        voice.dopplerLevel = doppler ? 1f : 0f;
    }

    public static float SceneConeGain(Transform emitter, Vector3 listener, float innerAngle,
        float outerAngle, float outerGain)
    {
        Vector3 ray = listener - emitter.position;
        if (ray.sqrMagnitude < 0.000001f) return 1f;
        float angle = 2f * Vector3.Angle(emitter.forward, ray);
        if (angle <= innerAngle) return 1f;
        return Mathf.Lerp(1f, Mathf.Clamp01(outerGain),
            Mathf.Clamp01((angle - innerAngle) / Mathf.Max(0.001f, outerAngle - innerAngle)));
    }

    private sealed class SoundPool
    {
        public readonly AudioClip[] Clips;
        public int NextIndex;

        public SoundPool(AudioClip[] clips)
        {
            Clips = clips;
            NextIndex = 0;
        }
    }

    private sealed class LoopState
    {
        public int Handle;
        public AudioSource Source;
        public AudioLowPassFilter LowPass;
        public Transform FollowTarget;
        public float BasePitch;
        public float PitchVariance;
        public float BaseVolume;
        public bool IsFadingOut;
        public float FadeOutRate;
    }

    [Header("Voice Pool")]
    [SerializeField] private int initialOneShotPoolSize = 12;

    [Header("Default 3D Spatial Settings")]
    [SerializeField] private AudioRolloffMode defaultRolloffMode = AudioRolloffMode.Logarithmic;
    [SerializeField] private float defaultMinDistance = 1f;
    [SerializeField] private float defaultMaxDistance = 35f;
    [SerializeField] private float defaultDopplerLevel = 0f;

    [Header("Default Pitch Variation")]
    [SerializeField] private float defaultPitchJitter = 0.05f;

    private readonly Dictionary<string, SoundPool> _pools = new Dictionary<string, SoundPool>();
    private readonly List<AudioSource> _oneShotSources = new List<AudioSource>();
    private readonly Stack<AudioSource> _idleLoopSources = new Stack<AudioSource>();
    private readonly Dictionary<int, LoopState> _activeLoops = new Dictionary<int, LoopState>();
    private readonly List<int> _scratchHandles = new List<int>();

    private int _nextLoopHandle = 1;
    private int _voiceCounter;

    private void Awake()
    {
        int count = Mathf.Max(0, initialOneShotPoolSize);
        for (int i = 0; i < count; i++)
        {
            _oneShotSources.Add(CreateVoice("OneShotVoice"));
        }
    }

    private void LateUpdate()
    {
        if (_activeLoops.Count == 0)
        {
            return;
        }

        _scratchHandles.Clear();
        float dt = Time.unscaledDeltaTime;

        foreach (KeyValuePair<int, LoopState> kvp in _activeLoops)
        {
            LoopState state = kvp.Value;
            if (state.Source == null)
            {
                _scratchHandles.Add(kvp.Key);
                continue;
            }

            if (state.FollowTarget != null)
            {
                state.Source.transform.position = state.FollowTarget.position;
            }

            if (state.IsFadingOut)
            {
                float nextVol = state.Source.volume - (state.FadeOutRate * dt);
                if (nextVol <= 0.0001f)
                {
                    _scratchHandles.Add(kvp.Key);
                }
                else
                {
                    state.Source.volume = nextVol;
                }
            }
        }

        for (int i = 0; i < _scratchHandles.Count; i++)
        {
            int handle = _scratchHandles[i];
            if (_activeLoops.TryGetValue(handle, out LoopState state))
            {
                ReleaseLoop(state);
                _activeLoops.Remove(handle);
            }
        }
    }

    private void OnDestroy()
    {
        _activeLoops.Clear();
        _idleLoopSources.Clear();
        _oneShotSources.Clear();
        _pools.Clear();
    }

    /// <summary>
    /// Registers a 3-variant clip pool under the specified sound ID.
    /// </summary>
    public void RegisterPool(string id, AudioClip clip1, AudioClip clip2, AudioClip clip3)
    {
        RegisterPool(id, new[] { clip1, clip2, clip3 });
    }

    /// <summary>
    /// Registers a clip pool under the specified sound ID.
    /// </summary>
    public void RegisterPool(string id, params AudioClip[] clips)
    {
        if (string.IsNullOrEmpty(id))
        {
            Debug.LogWarning("[GameAudioHelper] Cannot register pool with null or empty ID.");
            return;
        }

        if (clips == null || clips.Length == 0)
        {
            Debug.LogWarning("[GameAudioHelper] No clips provided for pool '" + id + "'.");
            return;
        }

        List<AudioClip> valid = new List<AudioClip>(clips.Length);
        for (int i = 0; i < clips.Length; i++)
        {
            if (clips[i] != null)
            {
                valid.Add(clips[i]);
            }
        }

        if (valid.Count == 0)
        {
            Debug.LogWarning("[GameAudioHelper] All clips were null for pool '" + id + "'.");
            return;
        }

        _pools[id] = new SoundPool(valid.ToArray());
    }

    /// <summary>
    /// Loads Resources/&lt;resourcesFolder&gt;/&lt;id&gt;-01 .. -03 (WAV imported as AudioClip)
    /// and registers them as a pool under <paramref name="id"/>.
    /// </summary>
    public bool RegisterPoolFromResources(string id, string resourcesFolder = "LuminaSfx/audio", int variantCount = 3)
    {
        if (string.IsNullOrEmpty(id) || variantCount <= 0)
        {
            return false;
        }

        string folder = string.IsNullOrEmpty(resourcesFolder) ? string.Empty : resourcesFolder.Trim('/');
        List<AudioClip> loaded = new List<AudioClip>(variantCount);

        for (int i = 1; i <= variantCount; i++)
        {
            string path = string.IsNullOrEmpty(folder)
                ? string.Format("{0}-{1:D2}", id, i)
                : string.Format("{0}/{1}-{2:D2}", folder, id, i);

            AudioClip clip = Resources.Load<AudioClip>(path);
            if (clip != null)
            {
                loaded.Add(clip);
            }
            else
            {
                Debug.LogWarning("[GameAudioHelper] Missing Resources AudioClip at '" + path + "'.");
            }
        }

        if (loaded.Count == 0)
        {
            return false;
        }

        _pools[id] = new SoundPool(loaded.ToArray());
        return true;
    }

    public bool HasPool(string id)
    {
        return !string.IsNullOrEmpty(id) && _pools.ContainsKey(id);
    }

    public bool UnregisterPool(string id)
    {
        return !string.IsNullOrEmpty(id) && _pools.Remove(id);
    }

    /// <summary>
    /// Plays the next cycled variant in 3D space with small per-play pitch variation.
    /// </summary>
    public AudioSource PlayOneShot3D(
        string id,
        Vector3 position,
        float volume = 1f,
        float basePitch = 1f,
        float? pitchJitter = null,
        float? minDistance = null,
        float? maxDistance = null,
        AudioRolloffMode? rolloffMode = null)
    {
        AudioClip clip = NextClip(id);
        if (clip == null)
        {
            return null;
        }

        AudioSource source = AcquireOneShotSource();
        ConfigureSpatial(source, true, position, minDistance, maxDistance, rolloffMode);

        float variance = RollPitchMultiplier(pitchJitter ?? defaultPitchJitter);
        source.clip = clip;
        source.loop = false;
        source.volume = Mathf.Clamp01(volume);
        source.pitch = ClampPitch(basePitch * variance);
        source.Play();
        return source;
    }

    /// <summary>
    /// Plays the next cycled variant as a non-positional 2D sound with small per-play pitch variation.
    /// </summary>
    public AudioSource PlayOneShot2D(
        string id,
        float volume = 1f,
        float basePitch = 1f,
        float? pitchJitter = null)
    {
        AudioClip clip = NextClip(id);
        if (clip == null)
        {
            return null;
        }

        AudioSource source = AcquireOneShotSource();
        ConfigureSpatial(source, false, transform.position, null, null, null);

        float variance = RollPitchMultiplier(pitchJitter ?? defaultPitchJitter);
        source.clip = clip;
        source.loop = false;
        source.volume = Mathf.Clamp01(volume);
        source.pitch = ClampPitch(basePitch * variance);
        source.Play();
        return source;
    }

    /// <summary>
    /// Starts a looping playback of the next cycled variant and returns a live loop handle (-1 on failure).
    /// Per-play pitch variation is captured at start and preserved across all live updates.
    /// </summary>
    public int StartLoop(
        string id,
        Vector3 position,
        float volume = 1f,
        float basePitch = 1f,
        float? pitchJitter = null,
        bool spatial = true,
        Transform followTarget = null,
        float? minDistance = null,
        float? maxDistance = null,
        AudioRolloffMode? rolloffMode = null)
    {
        AudioClip clip = NextClip(id);
        if (clip == null)
        {
            return -1;
        }

        AudioSource source = AcquireLoopSource();
        Vector3 startPos = followTarget != null ? followTarget.position : position;
        ConfigureSpatial(source, spatial, startPos, minDistance, maxDistance, rolloffMode);

        AudioLowPassFilter lowPass = source.GetComponent<AudioLowPassFilter>();
        if (lowPass != null)
        {
            lowPass.cutoffFrequency = 22000f;
            lowPass.enabled = false;
        }

        float variance = RollPitchMultiplier(pitchJitter ?? defaultPitchJitter);
        float clampedVolume = Mathf.Clamp01(volume);

        source.clip = clip;
        source.loop = true;
        source.volume = clampedVolume;
        source.pitch = ClampPitch(basePitch * variance);
        source.Play();

        int handle = _nextLoopHandle++;
        _activeLoops[handle] = new LoopState
        {
            Handle = handle,
            Source = source,
            LowPass = lowPass,
            FollowTarget = followTarget,
            BasePitch = basePitch,
            PitchVariance = variance,
            BaseVolume = clampedVolume,
            IsFadingOut = false,
            FadeOutRate = 0f
        };

        return handle;
    }

    /// <summary>
    /// Live-updates an active loop while preserving its initial per-play pitch variation.
    /// </summary>
    public bool UpdateLoop(
        int handle,
        float? volume = null,
        float? basePitch = null,
        Vector3? position = null,
        float? lowPassCutoffHz = null)
    {
        if (!_activeLoops.TryGetValue(handle, out LoopState state) || state.IsFadingOut || state.Source == null)
        {
            return false;
        }

        if (volume.HasValue)
        {
            state.BaseVolume = Mathf.Clamp01(volume.Value);
            state.Source.volume = state.BaseVolume;
        }

        if (basePitch.HasValue)
        {
            state.BasePitch = basePitch.Value;
            state.Source.pitch = ClampPitch(state.BasePitch * state.PitchVariance);
        }

        if (position.HasValue)
        {
            state.FollowTarget = null;
            state.Source.transform.position = position.Value;
        }

        if (lowPassCutoffHz.HasValue)
        {
            float cutoff = Mathf.Clamp(lowPassCutoffHz.Value, 10f, 22000f);
            if (cutoff < 21999f)
            {
                if (state.LowPass == null)
                {
                    state.LowPass = state.Source.gameObject.AddComponent<AudioLowPassFilter>();
                }
                state.LowPass.enabled = true;
                state.LowPass.cutoffFrequency = cutoff;
            }
            else if (state.LowPass != null)
            {
                state.LowPass.cutoffFrequency = 22000f;
                state.LowPass.enabled = false;
            }
        }

        return true;
    }

    /// <summary>
    /// Updates a live engine/machinery loop from normalized RPM (0..1), preserving per-play pitch variation.
    /// </summary>
    public bool UpdateLoopRpm(
        int handle,
        float rpmNormalized,
        float minPitch = 0.65f,
        float maxPitch = 2.0f,
        float minVolume = 0.25f,
        float maxVolume = 1.0f,
        Vector3? position = null)
    {
        float t = Mathf.Clamp01(rpmNormalized);
        float targetPitch = Mathf.Lerp(minPitch, maxPitch, t);
        float targetVolume = Mathf.Lerp(minVolume, maxVolume, t);
        return UpdateLoop(handle, volume: targetVolume, basePitch: targetPitch, position: position);
    }

    /// <summary>
    /// Updates a live weather/ambience loop from normalized intensity (0..1) with volume, pitch,
    /// and low-pass cutoff modulation while preserving per-play pitch variation.
    /// </summary>
    public bool UpdateLoopWeather(
        int handle,
        float intensityNormalized,
        float minVolume = 0.0f,
        float maxVolume = 1.0f,
        float minPitch = 0.85f,
        float maxPitch = 1.15f,
        float minCutoffHz = 600f,
        float maxCutoffHz = 22000f,
        Vector3? position = null)
    {
        float t = Mathf.Clamp01(intensityNormalized);
        float targetVolume = Mathf.Lerp(minVolume, maxVolume, t);
        float targetPitch = Mathf.Lerp(minPitch, maxPitch, t);
        float targetCutoff = Mathf.Lerp(minCutoffHz, maxCutoffHz, t);
        return UpdateLoop(
            handle,
            volume: targetVolume,
            basePitch: targetPitch,
            position: position,
            lowPassCutoffHz: targetCutoff);
    }

    /// <summary>
    /// Stops an active loop immediately or fades it out over <paramref name="fadeOutSeconds"/>.
    /// </summary>
    public bool StopLoop(int handle, float fadeOutSeconds = 0f)
    {
        if (!_activeLoops.TryGetValue(handle, out LoopState state))
        {
            return false;
        }

        if (fadeOutSeconds <= 0f || state.Source == null || state.Source.volume <= 0.0001f)
        {
            ReleaseLoop(state);
            _activeLoops.Remove(handle);
            return true;
        }

        state.IsFadingOut = true;
        state.FadeOutRate = state.Source.volume / fadeOutSeconds;
        return true;
    }

    public bool IsLoopPlaying(int handle)
    {
        return _activeLoops.TryGetValue(handle, out LoopState state)
            && !state.IsFadingOut
            && state.Source != null
            && state.Source.isPlaying;
    }

    public void StopAllLoops(float fadeOutSeconds = 0f)
    {
        if (_activeLoops.Count == 0)
        {
            return;
        }

        _scratchHandles.Clear();
        foreach (int handle in _activeLoops.Keys)
        {
            _scratchHandles.Add(handle);
        }

        for (int i = 0; i < _scratchHandles.Count; i++)
        {
            StopLoop(_scratchHandles[i], fadeOutSeconds);
        }
    }

    private AudioClip NextClip(string id)
    {
        if (string.IsNullOrEmpty(id) || !_pools.TryGetValue(id, out SoundPool pool) || pool.Clips.Length == 0)
        {
            Debug.LogWarning("[GameAudioHelper] Sound pool '" + id + "' is not registered.");
            return null;
        }

        AudioClip clip = pool.Clips[pool.NextIndex];
        pool.NextIndex = (pool.NextIndex + 1) % pool.Clips.Length;
        return clip;
    }

    private AudioSource AcquireOneShotSource()
    {
        for (int i = 0; i < _oneShotSources.Count; i++)
        {
            AudioSource candidate = _oneShotSources[i];
            if (candidate != null && !candidate.isPlaying)
            {
                return candidate;
            }
        }

        AudioSource created = CreateVoice("OneShotVoice");
        _oneShotSources.Add(created);
        return created;
    }

    private AudioSource AcquireLoopSource()
    {
        while (_idleLoopSources.Count > 0)
        {
            AudioSource cached = _idleLoopSources.Pop();
            if (cached != null)
            {
                return cached;
            }
        }

        return CreateVoice("LoopVoice");
    }

    private AudioSource CreateVoice(string prefix)
    {
        GameObject go = new GameObject(prefix + "_" + (++_voiceCounter));
        go.transform.SetParent(transform, false);
        AudioSource source = go.AddComponent<AudioSource>();
        source.playOnAwake = false;
        source.loop = false;
        source.spatialBlend = 1f;
        source.rolloffMode = defaultRolloffMode;
        source.minDistance = Mathf.Max(0.01f, defaultMinDistance);
        source.maxDistance = Mathf.Max(source.minDistance + 0.01f, defaultMaxDistance);
        source.dopplerLevel = Mathf.Max(0f, defaultDopplerLevel);
        return source;
    }

    private void ConfigureSpatial(
        AudioSource source,
        bool spatial,
        Vector3 position,
        float? minDistance,
        float? maxDistance,
        AudioRolloffMode? rolloffMode)
    {
        source.transform.position = position;
        source.spatialBlend = spatial ? 1f : 0f;
        if (spatial)
        {
            float minDist = Mathf.Max(0.01f, minDistance ?? defaultMinDistance);
            float maxDist = Mathf.Max(minDist + 0.01f, maxDistance ?? defaultMaxDistance);
            source.rolloffMode = rolloffMode ?? defaultRolloffMode;
            source.minDistance = minDist;
            source.maxDistance = maxDist;
            source.dopplerLevel = Mathf.Max(0f, defaultDopplerLevel);
        }
    }

    private void ReleaseLoop(LoopState state)
    {
        if (state.Source == null)
        {
            return;
        }

        state.Source.Stop();
        state.Source.clip = null;
        state.Source.loop = false;
        state.FollowTarget = null;

        if (state.LowPass != null)
        {
            state.LowPass.cutoffFrequency = 22000f;
            state.LowPass.enabled = false;
        }

        _idleLoopSources.Push(state.Source);
    }

    private static float RollPitchMultiplier(float pitchJitter)
    {
        float jitter = Mathf.Clamp(Mathf.Abs(pitchJitter), 0f, 0.5f);
        return jitter > 0f ? 1f + Random.Range(-jitter, jitter) : 1f;
    }

    private static float ClampPitch(float pitch)
    {
        return Mathf.Clamp(pitch, 0.1f, 3.0f);
    }
}
