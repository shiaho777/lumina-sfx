// Optional macOS release QA. Read one WAV path per line; emit one JSON result per input.
import Foundation
import SoundAnalysis
import CoreMedia

final class Observer: NSObject, SNResultsObserving {
    var windows = 0
    var top: [String: (score: Double, at: Double)] = [:]
    var failure: String?
    func request(_ request: SNRequest, didProduce result: SNResult) {
        guard let event = result as? SNClassificationResult else {return}
        windows += 1
        for item in event.classifications.prefix(12) where item.confidence >= 0.08 {
            if item.confidence > (top[item.identifier]?.score ?? 0) {
                top[item.identifier] = (item.confidence, event.timeRange.start.seconds)
            }
        }
    }
    func request(_ request: SNRequest, didFailWithError error: Error) {failure = error.localizedDescription}
}
func emit(_ payload: [String: Any]) throws {
    let data = try JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([10]))
}
let classifier = try SNClassifySoundRequest(classifierIdentifier: .version1)
classifier.overlapFactor = 0.5
classifier.windowDuration = CMTime(seconds: 0.975, preferredTimescale: 48000)
while let path = readLine() {
    autoreleasepool {
        do {
            let analyzer = try SNAudioFileAnalyzer(url: URL(fileURLWithPath: path))
            let observer = Observer()
            try analyzer.add(classifier, withObserver: observer)
            analyzer.analyze()
            if let failure = observer.failure {try emit(["error":failure]);return}
            try emit(["windows":observer.windows,"labels":observer.top.mapValues { ["score":$0.score,"at":$0.at] }])
        } catch {try? emit(["error":String(describing:error)])}
    }
}
