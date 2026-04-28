import { getExampleImplementation } from "../../example-implementation.js";
import { getDefaultEnvironmentProjections, resolveRuntimeTopology, runtimeUrls } from "../runtime/shared.js";

/** Pinned toolchains for reproducible native parity stubs (document in README). */
export const NATIVE_PARITY_PINNED = {
  gradleDistribution: "8.7",
  androidGradlePlugin: "8.6.0",
  kotlin: "1.9.24",
  compileSdk: 34,
  minSdk: 26,
  targetSdk: 34,
  swiftTools: "5.9",
  iosDeploymentMajor: 17,
  macOSCompanionMajor: 14
};

const ANDROID_PACKAGE = "io.topogram.nativeparity";

function escapeKotlinString(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

function escapeSwiftString(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

function buildNativeParityPlan(graph, options = {}) {
  const runtimeReference = getExampleImplementation(graph, options).runtime.reference;
  const topology = resolveRuntimeTopology(graph, options);
  const { apiProjection, uiProjection, dbProjection } = getDefaultEnvironmentProjections(graph, options);
  const urls = runtimeUrls(runtimeReference, topology);
  const demoUserId = runtimeReference.demoEnv?.userId ?? null;

  return {
    type: "native_parity_plan",
    name: "native_parity_plan",
    projections: {
      api: apiProjection.id,
      ui: uiProjection.id,
      db: dbProjection.id
    },
    pinned_toolchains: { ...NATIVE_PARITY_PINNED },
    resolved_urls: {
      PUBLIC_TOPOGRAM_API_BASE_URL: urls.api,
      PUBLIC_TOPOGRAM_WEB_BASE_URL: urls.web
    },
    demo_user_id: demoUserId,
    android: {
      package: ANDROID_PACKAGE,
      application_id: ANDROID_PACKAGE
    },
    ios: {
      module: "TopogramNativeParity",
      swift_tools_version: NATIVE_PARITY_PINNED.swiftTools
    }
  };
}

function renderRootReadme(plan, urls) {
  const demoOpsUrl =
    "https://github.com/attebury/topogram/blob/main/docs/README.md";
  return `# Native parity bundle

Minimal **Android (Gradle/Kotlin)** and **iOS (Swift Package / SwiftUI)** stubs wired to the same runtime URL metadata as other Topogram bundles.

## Resolved URLs (from workspace)

- **API:** \`${urls.api}\`
- **Web:** \`${urls.web}\`

Plan metadata: \`native-parity-plan.json\`.

## Android (\`android/\`)

Pinned AGP **${plan.pinned_toolchains.androidGradlePlugin}**, Kotlin **${plan.pinned_toolchains.kotlin}**, compile/target SDK **${plan.pinned_toolchains.compileSdk}**.

If \`gradlew\` is not present, generate the wrapper once (requires a local Gradle install):

\`\`\`bash
cd android
gradle wrapper --gradle-version ${plan.pinned_toolchains.gradleDistribution}
./gradlew assembleDebug
\`\`\`

## iOS (\`ios/\`)

Swift tools **${plan.pinned_toolchains.swiftTools}**, iOS **${plan.pinned_toolchains.iosDeploymentMajor}+** (Swift Package).

Open \`Package.swift\` in Xcode or build on macOS:

\`\`\`bash
cd ios
swift build
\`\`\`

(\`swift build\` requires Swift; iOS-only SwiftUI may require Xcode for simulator/device builds.)

## Promotion

Native parity promotion is deferred while the active docs focus on generated app demos. See [Topogram docs](${demoOpsUrl}).
`;
}

function renderAndroidFiles(plan, apiUrl) {
  const kotlinApi = escapeKotlinString(apiUrl);

  return {
    "android/settings.gradle.kts": `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "TopogramNativeParity"
include(":app")
`,
    "android/build.gradle.kts": `plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
}
`,
    "android/gradle.properties": `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.nonTransitiveRClass=true
kotlin.code.style=official
`,
    "android/gradle/libs.versions.toml": `[versions]
agp = "${plan.pinned_toolchains.androidGradlePlugin}"
kotlin = "${plan.pinned_toolchains.kotlin}"
compileSdk = "${plan.pinned_toolchains.compileSdk}"
minSdk = "${plan.pinned_toolchains.minSdk}"
targetSdk = "${plan.pinned_toolchains.targetSdk}"
appcompat = "1.6.1"

[libraries]
androidx-appcompat = { group = "androidx.appcompat", name = "appcompat", version.ref = "appcompat" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
`,
    "android/gradle/wrapper/gradle-wrapper.properties": `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-${plan.pinned_toolchains.gradleDistribution}-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`,
    "android/app/build.gradle.kts": `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "${ANDROID_PACKAGE}"
    compileSdk = libs.versions.compileSdk.get().toInt()

    defaultConfig {
        applicationId = "${ANDROID_PACKAGE}"
        minSdk = libs.versions.minSdk.get().toInt()
        targetSdk = libs.versions.targetSdk.get().toInt()
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation(libs.androidx.appcompat)
}
`,
    [`android/app/src/main/java/${ANDROID_PACKAGE.replaceAll(".", "/")}/ParityConfig.kt`]: `package ${ANDROID_PACKAGE}

/**
 * Resolved from Topogram native-parity bundle generation (matches runtimeUrls.api).
 */
object ParityConfig {
    const val API_BASE_URL: String = "${kotlinApi}"
}
`,
    [`android/app/src/main/java/${ANDROID_PACKAGE.replaceAll(".", "/")}/MainActivity.kt`]: `package ${ANDROID_PACKAGE}

import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val label = TextView(this).apply {
            text = ParityConfig.API_BASE_URL
            textSize = 14f
            setPadding(32, 32, 32, 32)
        }
        setContentView(label)
    }
}
`,
    "android/app/src/main/AndroidManifest.xml": `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <application
        android:allowBackup="true"
        android:label="Topogram parity"
        android:supportsRtl="true"
        android:theme="@style/Theme.AppCompat.Light.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>
`
  };
}

function renderIosFiles(plan, apiUrl) {
  const swiftApi = escapeSwiftString(apiUrl);
  const iosMajor = plan.pinned_toolchains.iosDeploymentMajor;
  const macMajor = plan.pinned_toolchains.macOSCompanionMajor;
  // Platforms use Swift literal suffixes .v17 — templating `${iosMajor}` yields `.v17`.

  return {
    "ios/Package.swift": `// swift-tools-version: ${plan.pinned_toolchains.swiftTools}
import PackageDescription

let package = Package(
    name: "TopogramNativeParity",
    platforms: [.iOS(.v${iosMajor}), .macOS(.v${macMajor})],
    products: [
        .library(name: "TopogramNativeParity", targets: ["TopogramNativeParity"])
    ],
    targets: [
        .target(
            name: "TopogramNativeParity",
            path: "Sources/TopogramNativeParity"
        )
    ]
)
`,
    "ios/Sources/TopogramNativeParity/ParityConfig.swift": `import Foundation

public enum ParityConfig {
    /// Resolved from Topogram runtimeUrls at generation time.
    public static let apiBaseURL: URL = URL(string: "${swiftApi}")!
}
`,
    "ios/Sources/TopogramNativeParity/ParityRootView.swift": `import SwiftUI

public struct ParityRootView: View {
    public init() {}

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Topogram native parity stub")
                .font(.headline)
            Text(ParityConfig.apiBaseURL.absoluteString)
                .font(.footnote)
                .textSelection(.enabled)
        }
        .padding()
    }
}
`
  };
}

export function generateNativeParityPlan(graph, options = {}) {
  return buildNativeParityPlan(graph, options);
}

export function generateNativeParityBundle(graph, options = {}) {
  const plan = buildNativeParityPlan(graph, options);
  const runtimeReference = getExampleImplementation(graph, options).runtime.reference;
  const urls = runtimeUrls(runtimeReference, resolveRuntimeTopology(graph, options));

  return {
    "native-parity-plan.json": `${JSON.stringify(plan, null, 2)}\n`,
    "README.md": renderRootReadme(plan, urls),
    ...renderAndroidFiles(plan, urls.api),
    ...renderIosFiles(plan, urls.api)
  };
}
