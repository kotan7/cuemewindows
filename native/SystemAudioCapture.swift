import Foundation
import ScreenCaptureKit
import AVFoundation
import CoreAudio

@available(macOS 13.0, *)
class SystemAudioCapture: NSObject {
    private var stream: SCStream?
    private var audioEngine: AVAudioEngine?
    private var isCapturing = false
    private var outputPipe: FileHandle?
    private var audioFormat: AVAudioFormat?
    
    // Configuration
    private let sampleRate: Double = 16000.0
    private let channels: UInt32 = 1
    private let bufferSize: UInt32 = 1024
    
    override init() {
        super.init()
        setupAudioEngine()
    }
    
    private func setupAudioEngine() {
        audioEngine = AVAudioEngine()
        
        // Create audio format for 16kHz mono
        audioFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: sampleRate,
            channels: channels,
            interleaved: false
        )
        
        guard audioFormat != nil else {
            print("ERROR: Failed to create audio format")
            return
        }
    }
    
    func startCapture() async throws {
        guard !isCapturing else {
            print("INFO: Already capturing")
            return
        }
        
        print("INFO: Starting ScreenCaptureKit system audio capture...")
        
        // Get available content
        let content = try await SCShareableContent.excludingDesktopWindows(
            false,
            onScreenWindowsOnly: true
        )
        
        // Create stream configuration for system audio
        let config = SCStreamConfiguration()
        config.capturesAudio = true
        config.sampleRate = Int(sampleRate)
        config.channelCount = Int(channels)
        config.excludesCurrentProcessAudio = true
        config.minimumFrameInterval = CMTime(value: 1, timescale: 60) // 60 FPS
        
        // Create a filter that includes all applications (for system audio)
        let filter = SCContentFilter(display: content.displays.first!, excludingWindows: [])
        
        // Create and start the stream
        stream = SCStream(filter: filter, configuration: config, delegate: self)
        
        try await stream?.startCapture()
        isCapturing = true
        
        print("INFO: ScreenCaptureKit capture started successfully")
        print("STATUS: READY")
        fflush(stdout)
    }
    
    func stopCapture() async throws {
        guard isCapturing else {
            print("INFO: Not currently capturing")
            return
        }
        
        print("INFO: Stopping system audio capture...")
        
        try await stream?.stopCapture()
        stream = nil
        isCapturing = false
        
        audioEngine?.stop()
        
        print("INFO: System audio capture stopped")
        print("STATUS: STOPPED")
        fflush(stdout)
    }
    
    private func processAudioBuffer(_ audioBuffer: CMSampleBuffer) {
        guard let blockBuffer = CMSampleBufferGetDataBuffer(audioBuffer) else {
            return
        }
        
        var audioBufferList = AudioBufferList()
        var blockBufferRef: CMBlockBuffer?
        
        let status = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
            audioBuffer,
            bufferListSizeNeededOut: nil,
            bufferListOut: &audioBufferList,
            bufferListSize: MemoryLayout<AudioBufferList>.size,
            blockBufferAllocator: nil,
            blockBufferMemoryAllocator: nil,
            flags: kCMSampleBufferFlag_AudioBufferList_Assure16ByteAlignment,
            blockBufferOut: &blockBufferRef
        )
        
        guard status == noErr,
              let audioBuffer = audioBufferList.mBuffers.mData else {
            return
        }
        
        let frameCount = Int(audioBufferList.mBuffers.mDataByteSize) / MemoryLayout<Float32>.size
        let floatBuffer = audioBuffer.bindMemory(to: Float32.self, capacity: frameCount)
        
        // Convert to Data and send
        let audioData = Data(bytes: floatBuffer, count: frameCount * MemoryLayout<Float32>.size)
        sendAudioData(audioData)
    }
    
    private func sendAudioData(_ data: Data) {
        // Create a JSON message with the audio data
        let message: [String: Any] = [
            "type": "audio_data",
            "timestamp": Date().timeIntervalSince1970,
            "data": data.base64EncodedString(),
            "sampleRate": sampleRate,
            "channels": channels,
            "format": "float32"
        ]
        
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: message)
            if let jsonString = String(data: jsonData, encoding: .utf8) {
                print("AUDIO_DATA: \(jsonString)")
                fflush(stdout)
            }
        } catch {
            print("ERROR: Failed to serialize audio data: \(error)")
        }
    }
    
    func requestPermissions() async -> [String: Any] {
        print("INFO: Requesting ScreenCaptureKit permissions...")
        
        do {
            // Try to get screen content - this will trigger permission dialog if needed
            let content = try await SCShareableContent.excludingDesktopWindows(
                false,
                onScreenWindowsOnly: true
            )
            
            if !content.displays.isEmpty {
                print("INFO: Screen recording permission granted")
                return [
                    "granted": true,
                    "message": "Screen recording permission granted",
                    "displaysFound": content.displays.count
                ]
            } else {
                print("WARNING: No displays found - permission may be denied")
                return [
                    "granted": false,
                    "message": "No displays accessible - screen recording permission required",
                    "error": "PERMISSION_DENIED"
                ]
            }
        } catch {
            print("ERROR: Failed to access screen content: \(error)")
            return [
                "granted": false,
                "message": "Screen recording permission denied",
                "error": error.localizedDescription
            ]
        }
    }
    
    func getStatus() -> [String: Any] {
        // Check for ScreenCaptureKit availability and permissions
        var permissionStatus = "unknown"
        var permissionMessage = ""
        
        // Check screen recording permission
        if #available(macOS 14.0, *) {
            // Use newer permission check if available
            permissionStatus = "available"
            permissionMessage = "ScreenCaptureKit available with modern permission system"
        } else {
            // For macOS 13.0+, we need to check if we can actually access screen content
            permissionStatus = "legacy"
            permissionMessage = "ScreenCaptureKit available but may need screen recording permission"
        }
        
        return [
            "isCapturing": isCapturing,
            "sampleRate": sampleRate,
            "channels": channels,
            "isAvailable": true,
            "apiVersion": "ScreenCaptureKit",
            "permissionStatus": permissionStatus,
            "permissionMessage": permissionMessage,
            "macOSVersion": ProcessInfo.processInfo.operatingSystemVersionString
        ]
    }
}

@available(macOS 13.0, *)
extension SystemAudioCapture: SCStreamDelegate {
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio else { return }
        processAudioBuffer(sampleBuffer)
    }
    
    func stream(_ stream: SCStream, didStopWithError error: Error) {
        print("ERROR: Stream stopped with error: \(error)")
        isCapturing = false
        Task {
            try? await stopCapture()
        }
    }
}

// Fallback for older macOS versions
class LegacySystemAudioCapture: NSObject {
    func startCapture() async throws {
        throw NSError(
            domain: "SystemAudioCapture",
            code: -1,
            userInfo: [NSLocalizedDescriptionKey: "ScreenCaptureKit not available on this macOS version"]
        )
    }
    
    func stopCapture() async throws {
        // No-op for legacy
    }
    
    func getStatus() -> [String: Any] {
        return [
            "isCapturing": false,
            "sampleRate": 0,
            "channels": 0,
            "isAvailable": false,
            "apiVersion": "Legacy",
            "error": "Requires macOS 12.3 or later"
        ]
    }
}

// Main application
class SystemAudioCaptureApp {
    private var capture: Any?
    
    init() {
        if #available(macOS 13.0, *) {
            capture = SystemAudioCapture()
        } else {
            capture = LegacySystemAudioCapture()
        }
    }
    
    func run() async {
        print("INFO: SystemAudioCapture starting...")
        print("INFO: macOS version check...")
        
        if #available(macOS 13.0, *) {
            print("INFO: ScreenCaptureKit available")
        } else {
            print("WARNING: ScreenCaptureKit not available, requires macOS 13.0+")
        }
        
        // Check for command line arguments first
        let arguments = CommandLine.arguments
        if arguments.count > 1 {
            let command = arguments[1]
            await handleCommand(command)
            return
        }
        
        // Try to read from stdin with a timeout
        print("DEBUG: Waiting for stdin input...")
        
        let semaphore = DispatchSemaphore(value: 0)
        var receivedCommand: String? = nil
        
        // Set up stdin reading on a background queue
        DispatchQueue.global().async {
            if let line = readLine() {
                receivedCommand = line
            }
            semaphore.signal()
        }
        
        // Wait up to 2 seconds for input
        let timeoutResult = semaphore.wait(timeout: .now() + 2.0)
        
        if timeoutResult == .success, let command = receivedCommand {
            let trimmedCommand = command.trimmingCharacters(in: .whitespacesAndNewlines)
            print("DEBUG: Received command from stdin: '\(trimmedCommand)'")
            await handleCommand(trimmedCommand)
        } else {
            print("DEBUG: No command received, showing default status")
            await handleCommand("status")
        }
    }
    
    private func handleCommand(_ command: String) async {
        let parts = command.split(separator: " ")
        guard let action = parts.first else { 
            print("DEBUG: Empty command received")
            return 
        }
        
        print("DEBUG: Processing command: \(action)")
        
        switch action.lowercased() {
        case "start":
            do {
                if #available(macOS 13.0, *), let systemCapture = capture as? SystemAudioCapture {
                    try await systemCapture.startCapture()
                } else if let legacyCapture = capture as? LegacySystemAudioCapture {
                    try await legacyCapture.startCapture()
                }
            } catch {
                print("ERROR: Failed to start capture: \(error)")
            }
            
        case "stop":
            do {
                if #available(macOS 13.0, *), let systemCapture = capture as? SystemAudioCapture {
                    try await systemCapture.stopCapture()
                } else if let legacyCapture = capture as? LegacySystemAudioCapture {
                    try await legacyCapture.stopCapture()
                }
            } catch {
                print("ERROR: Failed to stop capture: \(error)")
            }
            
        case "status":
            var status: [String: Any] = [:]
            if #available(macOS 13.0, *), let systemCapture = capture as? SystemAudioCapture {
                status = systemCapture.getStatus()
            } else if let legacyCapture = capture as? LegacySystemAudioCapture {
                status = legacyCapture.getStatus()
            }
            
            do {
                let jsonData = try JSONSerialization.data(withJSONObject: status)
                if let jsonString = String(data: jsonData, encoding: .utf8) {
                    print("STATUS_DATA: \(jsonString)")
                    fflush(stdout)
                }
            } catch {
                print("ERROR: Failed to serialize status: \(error)")
            }
            
        case "permission", "permissions":
            if #available(macOS 13.0, *), let systemCapture = capture as? SystemAudioCapture {
                let result = await systemCapture.requestPermissions()
                
                do {
                    let jsonData = try JSONSerialization.data(withJSONObject: result)
                    if let jsonString = String(data: jsonData, encoding: .utf8) {
                        print("PERMISSION_RESULT: \(jsonString)")
                        fflush(stdout)
                    }
                } catch {
                    print("ERROR: Failed to serialize permission result: \(error)")
                }
            } else {
                let result: [String: Any] = [
                    "granted": false,
                    "message": "ScreenCaptureKit not available on this macOS version",
                    "error": "MACOS_VERSION_TOO_OLD"
                ]
                
                do {
                    let jsonData = try JSONSerialization.data(withJSONObject: result)
                    if let jsonString = String(data: jsonData, encoding: .utf8) {
                        print("PERMISSION_RESULT: \(jsonString)")
                        fflush(stdout)
                    }
                } catch {
                    print("ERROR: Failed to serialize permission result: \(error)")
                }
            }
            
        case "quit", "exit":
            print("INFO: Exiting...")
            exit(0)
            
        default:
            print("ERROR: Unknown command: \(command)")
            print("INFO: Available commands: start, stop, status, quit")
        }
    }
}

// Entry point
let app = SystemAudioCaptureApp()
Task {
    await app.run()
}