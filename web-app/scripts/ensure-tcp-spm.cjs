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

    // Ensure CAPBridgedPlugin is added to TcpSocketPlugin.swift
    const swiftFile = path.resolve(dir, 'ios/Plugin/TcpSocketPlugin.swift');
    if (fs.existsSync(swiftFile)) {
      let swiftContent = fs.readFileSync(swiftFile, 'utf8');
      if (!swiftContent.includes('CAPBridgedPlugin')) {
        swiftContent = swiftContent.replace(
          /@objc\(TcpSocketPlugin\)\s*public class TcpSocketPlugin:\s*CAPPlugin\s*\{/,
          `@objc(TcpSocketPlugin)\npublic class TcpSocketPlugin: CAPPlugin, CAPBridgedPlugin {\n    public let identifier = "TcpSocketPlugin"\n    public let jsName = "TcpSocket"\n    public let pluginMethods: [CAPPluginMethod] = [\n        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),\n        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise),\n        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),\n        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),\n        CAPPluginMethod(name: "listen", returnType: CAPPluginReturnPromise),\n        CAPPluginMethod(name: "stopListening", returnType: CAPPluginReturnPromise),\n        CAPPluginMethod(name: "getLocalAddress", returnType: CAPPluginReturnPromise)\n    ]\n`
        );
        fs.writeFileSync(swiftFile, swiftContent, 'utf8');
        console.log('[postinstall] Successfully patched TcpSocketPlugin.swift with CAPBridgedPlugin');
      }
    }
  }
} catch (e) {
  console.warn('[postinstall] Warning patching capacitor-tcp-socket:', e.message);
}
