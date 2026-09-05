// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "ResearchReader",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .executable(name: "ResearchReader", targets: ["ResearchReader"]),
    ],
    targets: [
        .executableTarget(
            name: "ResearchReader",
            path: "MacApp",
            resources: [
                .copy("Resources"),
            ]
        ),
    ]
)
