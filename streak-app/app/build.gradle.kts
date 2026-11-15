plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.streak.app"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.streak.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 2
        versionName = "1.0"
    }
    signingConfigs {
        create("fixed") {
            storeFile = file("release.keystore")
            storePassword = "appkey123"
            keyAlias = "app"
            keyPassword = "appkey123"
        }
    }
    buildTypes {
        getByName("debug") { signingConfig = signingConfigs.getByName("fixed") }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
