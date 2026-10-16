// Config plugin: a foreground service that keeps the app process (and therefore
// the live SSE connection) alive in the background, so "app closed / screen off"
// notifications still arrive WITHOUT Firebase/FCM or any third-party push.
//
// Only the Android service + a tiny native module (start/stop) are added; the
// notification logic is unchanged and still lives in JS. `android/` is generated
// by `expo prebuild`, so all of this is injected at prebuild time.
const { withAndroidManifest, withDangerousMod, withMainApplication } = require("expo/config-plugins")
const fs = require("fs")
const path = require("path")

const MODULE_NAME = "BackgroundConnection"
const SERVICE_CLASS = "BackgroundConnectionService"

function packageName(config) {
  const pkg = config.android?.package
  if (!pkg) throw new Error("withBackgroundConnection: android.package is required")
  return pkg
}

function kotlinSources(pkg) {
  const service = `package ${pkg}

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder

/**
 * Keeps the React Native process (and its live opencode SSE connection) from
 * being frozen or killed while the app is backgrounded, so JS can raise local
 * notifications for permission prompts, questions and usage limits.
 *
 * This deliberately does no networking of its own: the JS runtime already owns
 * the connection; the service only holds the process up and shows the required
 * ongoing notification.
 */
class ${SERVICE_CLASS} : Service() {
  companion object {
    private const val CHANNEL_ID = "opencode_background_connection"
    private const val NOTIFICATION_ID = 4201
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startForeground(NOTIFICATION_ID, buildNotification())
    return START_STICKY
  }

  private fun buildNotification(): Notification {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Background connection",
        NotificationManager.IMPORTANCE_LOW,
      )
      channel.description = "Keeps the OpenCode session connected so notifications arrive"
      channel.setShowBadge(false)
      manager.createNotificationChannel(channel)
    }

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    return builder
      .setContentTitle("OpenCode")
      .setContentText("Connected — keeping the session alive for notifications")
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .build()
  }

  override fun onDestroy() {
    stopForeground(true)
    super.onDestroy()
  }
}
`

  const module = `package ${pkg}

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class BackgroundConnectionModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  override fun getName(): String = "${MODULE_NAME}"

  @ReactMethod
  fun start() {
    val intent = Intent(context, ${SERVICE_CLASS}::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(intent)
    } else {
      context.startService(intent)
    }
  }

  @ReactMethod
  fun stop() {
    context.stopService(Intent(context, ${SERVICE_CLASS}::class.java))
  }
}
`

  const reactPackage = `package ${pkg}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class BackgroundConnectionPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(BackgroundConnectionModule(context))

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
`

  return { service, module, reactPackage }
}

const withBackgroundServiceSources = (config) =>
  withDangerousMod(config, [
    "android",
    async (config) => {
      const pkg = packageName(config)
      const javaDir = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "java",
        ...pkg.split("."),
      )
      fs.mkdirSync(javaDir, { recursive: true })
      const sources = kotlinSources(pkg)
      fs.writeFileSync(path.join(javaDir, `${SERVICE_CLASS}.kt`), sources.service)
      fs.writeFileSync(path.join(javaDir, "BackgroundConnectionModule.kt"), sources.module)
      fs.writeFileSync(path.join(javaDir, "BackgroundConnectionPackage.kt"), sources.reactPackage)
      return config
    },
  ])

const withBackgroundServiceManifest = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest
    const application = manifest.application?.[0]
    if (!application) throw new Error("withBackgroundConnection: no <application> in AndroidManifest")

    manifest["uses-permission"] = manifest["uses-permission"] ?? []
    const addPermission = (name) => {
      const exists = manifest["uses-permission"].some((p) => p.$?.["android:name"] === name)
      if (!exists) manifest["uses-permission"].push({ $: { "android:name": name } })
    }
    addPermission("android.permission.FOREGROUND_SERVICE")
    addPermission("android.permission.FOREGROUND_SERVICE_DATA_SYNC")

    application.service = application.service ?? []
    const serviceName = `.${SERVICE_CLASS}`
    const exists = application.service.some((s) => s.$?.["android:name"] === serviceName)
    if (!exists) {
      application.service.push({
        $: {
          "android:name": serviceName,
          "android:foregroundServiceType": "dataSync",
          "android:exported": "false",
        },
      })
    }
    return config
  })

const withBackgroundServiceRegistration = (config) =>
  withMainApplication(config, (config) => {
    const marker = /PackageList\(this\)\.packages\.apply\s*\{/
    if (!marker.test(config.modResults.contents)) {
      throw new Error(
        "withBackgroundConnection: could not find PackageList(...).apply { } in MainApplication to register the module",
      )
    }
    config.modResults.contents = config.modResults.contents.replace(
      marker,
      (match) => `${match}\n            add(BackgroundConnectionPackage())`,
    )
    return config
  })

const withBackgroundConnection = (config) =>
  withBackgroundServiceRegistration(
    withBackgroundServiceManifest(withBackgroundServiceSources(config)),
  )

module.exports = withBackgroundConnection
