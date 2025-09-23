// swift-tools-version: 5.7
import PackageDescription

let package = Package(
    name: "SystemAudioCapture",
    platforms: [
        .macOS(.v12)
    ],
    targets: [
        .executableTarget(
            name: "SystemAudioCapture",
            path: ".",
            sources: ["SystemAudioCapture.swift"]
        )
    ]
)