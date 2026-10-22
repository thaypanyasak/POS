const fs = require('fs');
const path = require('path');

const packageSwiftPath = path.resolve(__dirname, 'node_modules/@deedarb/capacitor-tcp-socket/Package.swift');

const content = `// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "DeedarbCapacitorTcpSocket",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "DeedarbCapacitorTcpSocket",
            targets: ["TcpSocketPlugin"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(url: "https://github.com/Kitura/BlueSocket.git", from: "2.0.0")
    ],
    targets: [
        .target(
            name: "TcpSocketPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Socket", package: "BlueSocket")
            ],
            path: "ios/Plugin",
            exclude: ["Info.plist"]
        )
    ]
)
`;

try {
  const dir = path.dirname(packageSwiftPath);
  if (fs.existsSync(dir)) {
    fs.writeFileSync(packageSwiftPath, content, 'utf8');
    console.log('[postinstall] Successfully ensured Package.swift for @deedarb/capacitor-tcp-socket');
  }
} catch (e) {
  console.warn('[postinstall] Warning creating Package.swift:', e.message);
}
