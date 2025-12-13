package com.comicreader.app

import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import okhttp3.OkHttpClient
import okhttp3.Credentials
import java.net.InetSocketAddress
import java.net.Proxy
import java.net.Authenticator
import java.net.PasswordAuthentication

/**
 * React Native 原生代理模块
 * 支持 HTTP, HTTPS, SOCKS5 代理配置
 */
class ProxyModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "ProxyModule"
        
        // 全局代理配置
        @Volatile
        var proxyHost: String? = null
        @Volatile
        var proxyPort: Int = 0
        @Volatile
        var proxyType: Proxy.Type = Proxy.Type.DIRECT
        @Volatile
        var proxyUsername: String? = null
        @Volatile
        var proxyPassword: String? = null
        @Volatile
        var proxyEnabled: Boolean = false
        
        /**
         * 获取配置了代理的 OkHttpClient
         */
        fun getProxyClient(baseClient: OkHttpClient): OkHttpClient {
            if (!proxyEnabled || proxyHost.isNullOrEmpty() || proxyPort <= 0) {
                return baseClient
            }
            
            val proxy = Proxy(proxyType, InetSocketAddress(proxyHost, proxyPort))
            
            val builder = baseClient.newBuilder().proxy(proxy)
            
            // 如果有认证信息，添加代理认证
            if (!proxyUsername.isNullOrEmpty() && !proxyPassword.isNullOrEmpty()) {
                builder.proxyAuthenticator { _, response ->
                    val credential = Credentials.basic(proxyUsername!!, proxyPassword!!)
                    response.request.newBuilder()
                        .header("Proxy-Authorization", credential)
                        .build()
                }
            }
            
            Log.i(TAG, "Using proxy: ${proxyType.name}://$proxyHost:$proxyPort")
            return builder.build()
        }
        
        /**
         * 获取当前代理配置
         */
        fun getCurrentProxy(): Proxy? {
            if (!proxyEnabled || proxyHost.isNullOrEmpty() || proxyPort <= 0) {
                return null
            }
            return Proxy(proxyType, InetSocketAddress(proxyHost, proxyPort))
        }
    }

    override fun getName(): String = "ProxyModule"

    /**
     * 设置代理配置
     * @param config ReadableMap 包含: type, host, port, username, password
     */
    @ReactMethod
    fun setProxy(config: ReadableMap, promise: Promise) {
        try {
            val type = config.getString("type") ?: "http"
            val host = config.getString("host") ?: ""
            val port = if (config.hasKey("port")) config.getInt("port") else 0
            val username = config.getString("username")
            val password = config.getString("password")
            
            proxyHost = host
            proxyPort = port
            proxyUsername = username
            proxyPassword = password
            
            // 设置代理类型
            proxyType = when (type.lowercase()) {
                "socks5", "socks" -> Proxy.Type.SOCKS
                "http", "https" -> Proxy.Type.HTTP
                else -> Proxy.Type.HTTP
            }
            
            proxyEnabled = host.isNotEmpty() && port > 0
            
            // 设置系统级认证器（用于 SOCKS5 认证）
            if (!username.isNullOrEmpty() && !password.isNullOrEmpty()) {
                Authenticator.setDefault(object : Authenticator() {
                    override fun getPasswordAuthentication(): PasswordAuthentication {
                        return PasswordAuthentication(username, password.toCharArray())
                    }
                })
            } else {
                Authenticator.setDefault(null)
            }
            
            Log.i(TAG, "Proxy configured: $type://$host:$port, enabled=$proxyEnabled")
            
            promise.resolve(mapOf(
                "success" to true,
                "message" to "代理配置成功: $type://$host:$port"
            ).toString())
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set proxy", e)
            promise.reject("PROXY_ERROR", "设置代理失败: ${e.message}", e)
        }
    }

    /**
     * 清除代理配置
     */
    @ReactMethod
    fun clearProxy(promise: Promise) {
        try {
            proxyHost = null
            proxyPort = 0
            proxyType = Proxy.Type.DIRECT
            proxyUsername = null
            proxyPassword = null
            proxyEnabled = false
            Authenticator.setDefault(null)
            
            Log.i(TAG, "Proxy cleared")
            promise.resolve(mapOf("success" to true, "message" to "代理已清除").toString())
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to clear proxy", e)
            promise.reject("PROXY_ERROR", "清除代理失败: ${e.message}", e)
        }
    }

    /**
     * 获取当前代理状态
     */
    @ReactMethod
    fun getProxyStatus(promise: Promise) {
        try {
            val status = mapOf(
                "enabled" to proxyEnabled,
                "type" to when (proxyType) {
                    Proxy.Type.SOCKS -> "socks5"
                    Proxy.Type.HTTP -> "http"
                    else -> "direct"
                },
                "host" to (proxyHost ?: ""),
                "port" to proxyPort,
                "hasAuth" to (!proxyUsername.isNullOrEmpty())
            )
            promise.resolve(status.toString())
        } catch (e: Exception) {
            promise.reject("PROXY_ERROR", "获取代理状态失败: ${e.message}", e)
        }
    }

    /**
     * 测试代理连接
     */
    @ReactMethod
    fun testProxy(testUrl: String, promise: Promise) {
        Thread {
            try {
                if (!proxyEnabled) {
                    promise.resolve(mapOf(
                        "success" to false,
                        "message" to "代理未启用"
                    ).toString())
                    return@Thread
                }
                
                val proxy = Proxy(proxyType, InetSocketAddress(proxyHost, proxyPort))
                val client = OkHttpClient.Builder()
                    .proxy(proxy)
                    .connectTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
                    .readTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
                    .build()
                
                val startTime = System.currentTimeMillis()
                
                val request = okhttp3.Request.Builder()
                    .url(testUrl)
                    .build()
                
                val response = client.newCall(request).execute()
                val latency = System.currentTimeMillis() - startTime
                
                val success = response.isSuccessful
                response.close()
                
                promise.resolve(mapOf(
                    "success" to success,
                    "message" to if (success) "连接成功" else "连接失败: ${response.code}",
                    "latency" to latency,
                    "statusCode" to response.code
                ).toString())
                
            } catch (e: Exception) {
                Log.e(TAG, "Proxy test failed", e)
                promise.resolve(mapOf(
                    "success" to false,
                    "message" to "连接失败: ${e.message}",
                    "latency" to -1
                ).toString())
            }
        }.start()
    }
}
