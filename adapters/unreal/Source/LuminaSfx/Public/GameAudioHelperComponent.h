#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Sound/SoundAttenuation.h"
#include "GameAudioHelperComponent.generated.h"

class UAudioComponent;
class USoundWave;

USTRUCT(BlueprintType)
struct FGameAudioSoundPool
{
	GENERATED_BODY()

	/** Editor-imported USoundWave variants cycled round-robin on each play. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Game Audio")
	TArray<TObjectPtr<USoundWave>> Variants;

	int32 NextIndex = 0;
};

/**
 * Lightweight UE5 3D audio playback helper supporting 3-variant WAV pools,
 * per-play pitch variation, positional attenuation, and live RPM/weather loops.
 * Add your module export macro (e.g., MYGAME_API) if exposed across modules.
 */
UCLASS(ClassGroup = (Audio), meta = (BlueprintSpawnableComponent))
class LUMINASFX_API UGameAudioHelperComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UGameAudioHelperComponent();

	/** Sound pools configurable in the Editor Details panel or via RegisterPool* APIs. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Game Audio")
	TMap<FName, FGameAudioSoundPool> SoundPools;

	/** Default +/- pitch randomization applied per play (e.g., 0.05 = +/-5%). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Game Audio", meta = (ClampMin = "0.0", ClampMax = "0.5"))
	float DefaultPitchJitter = 0.05f;

	/** 3D distance attenuation curve used when CustomAttenuation is unset. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Game Audio|3D Attenuation")
	EAttenuationDistanceModel DistanceModel = EAttenuationDistanceModel::Inverse;

	/** Sphere radius (cm) at full volume before falloff begins. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Game Audio|3D Attenuation", meta = (ClampMin = "0.0"))
	float InnerRadius = 200.0f;

	/** Distance (cm) beyond InnerRadius over which sound attenuates. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Game Audio|3D Attenuation", meta = (ClampMin = "1.0"))
	float FalloffDistance = 3600.0f;

	/** Enable 3D panning spatialization. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Game Audio|3D Attenuation")
	bool bSpatialize = true;

	/** Optional attenuation asset override; if null, uses the 3D properties above. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Game Audio|3D Attenuation")
	TObjectPtr<USoundAttenuation> CustomAttenuation = nullptr;

	/** Live RPM modulation bounds (mapped from normalized RPM 0..1). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Game Audio|Live Controls")
	float RpmMinPitch = 0.75f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Game Audio|Live Controls")
	float RpmMaxPitch = 1.85f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Game Audio|Live Controls")
	float RpmMinVolume = 0.55f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Game Audio|Live Controls")
	float RpmMaxVolume = 1.0f;

	/** Live weather modulation bounds (mapped from normalized intensity 0..1). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Game Audio|Live Controls")
	float WeatherMinPitch = 0.92f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Game Audio|Live Controls")
	float WeatherMaxPitch = 1.12f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Game Audio|Live Controls")
	float WeatherMinVolume = 0.25f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Game Audio|Live Controls")
	float WeatherMaxVolume = 1.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Game Audio|Live Controls", meta = (ClampMin = "20.0", ClampMax = "20000.0"))
	float WeatherMinLowPassHz = 2200.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Game Audio|Live Controls", meta = (ClampMin = "20.0", ClampMax = "20000.0"))
	float WeatherMaxLowPassHz = 18000.0f;

	/** Register a pool of 3 Editor-imported USoundWave variants for an ID. */
	UFUNCTION(BlueprintCallable, Category = "Game Audio")
	bool RegisterPool(FName Id, USoundWave* Variant1, USoundWave* Variant2, USoundWave* Variant3);

	/** Load and register 3 USoundWave assets by paths relative to /Game/ (e.g., "audio/hit-01.wav"). */
	UFUNCTION(BlueprintCallable, Category = "Game Audio")
	bool RegisterPoolFromPaths(FName Id, const FString& RelativePath1, const FString& RelativePath2, const FString& RelativePath3);

	/** Convenience loader for "<RelativeFolder>/<Id>-01.wav" through "-03.wav" under /Game/. */
	UFUNCTION(BlueprintCallable, Category = "Game Audio")
	bool RegisterPoolById(FName Id, const FString& RelativeFolder = TEXT("LuminaSfx/audio"));

	/** Play the next variant in the pool at a 3D world location with small pitch variation. */
	UFUNCTION(BlueprintCallable, Category = "Game Audio")
	bool PlayOneShot(FName Id, FVector WorldLocation, float Volume = 1.0f, float PitchJitterOverride = -1.0f);

	/** Start a looping 3D sound tracked under LoopId; initial per-play pitch variation is preserved on live updates. */
	UFUNCTION(BlueprintCallable, Category = "Game Audio")
	bool StartLoop(FName LoopId, FName PoolId, FVector WorldLocation, float BaseVolume = 1.0f, bool bAttachToOwner = false, float PitchJitterOverride = -1.0f);

	/** Live-update an active loop's RPM (0..1) while preserving its per-play pitch variation. */
	UFUNCTION(BlueprintCallable, Category = "Game Audio")
	bool UpdateLoopRpm(FName LoopId, float NormalizedRpm);

	/** Live-update an active loop's weather intensity (0..1) while preserving its per-play pitch variation. */
	UFUNCTION(BlueprintCallable, Category = "Game Audio")
	bool UpdateLoopWeather(FName LoopId, float WeatherIntensity);

	/** Update a non-attached active loop's 3D world position. */
	UFUNCTION(BlueprintCallable, Category = "Game Audio")
	bool UpdateLoopLocation(FName LoopId, FVector WorldLocation);

	/** Stop an active loop immediately or with a linear fade-out duration (seconds). */
	UFUNCTION(BlueprintCallable, Category = "Game Audio")
	bool StopLoop(FName LoopId, float FadeOutDuration = 0.0f);

	/** Stop all active loops managed by this component. */
	UFUNCTION(BlueprintCallable, Category = "Game Audio")
	void StopAllLoops(float FadeOutDuration = 0.0f);

	/** Returns true if LoopId is currently active and playing. */
	UFUNCTION(BlueprintPure, Category = "Game Audio")
	bool IsLoopPlaying(FName LoopId) const;

    /** Convert a Lumina metre position (+X right, +Y up, -Z forward) to Unreal centimetres. */
    UFUNCTION(BlueprintPure, Category = "Game Audio")
    static FVector FromSceneMetres(FVector Position)
    {
        return FVector(-Position.Z, Position.X, Position.Y) * 100.0;
    }

    /** Convert the canonical facing into Unreal rotation. The source faces -Z at zero yaw. */
    UFUNCTION(BlueprintPure, Category = "Game Audio")
    static FRotator FromSceneFacing(float YawDegrees, float PitchDegrees)
    {
        return FRotator(PitchDegrees, YawDegrees, 0.0);
    }

protected:
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
	struct FActiveLoopState
	{
		TWeakObjectPtr<UAudioComponent> Component;
		float BaseVolume = 1.0f;
		float PitchVariation = 1.0f;
		float RpmNormalized = 0.0f;
		float WeatherIntensity = 0.0f;
		bool bUseRpmModulation = false;
		bool bUseWeatherModulation = false;
	};

	UPROPERTY(Transient)
	TObjectPtr<USoundAttenuation> RuntimeAttenuation = nullptr;

	TMap<FName, FActiveLoopState> ActiveLoops;

	USoundWave* GetNextVariant(FName Id);
	float RollPitchVariation(float PitchJitterOverride) const;
	USoundAttenuation* GetOrCreateAttenuation();
	void ApplyLoopParameters(const FActiveLoopState& State) const;
	static FString ResolveAssetPath(const FString& RelativePath);
};
