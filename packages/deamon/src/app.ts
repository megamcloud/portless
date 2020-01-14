import consola from 'consola'
import { loadConfig, PortlessConfig } from '@portless/config'
import { UseGreenlock, useGreenlock } from './greenlock'
import { UseReverseProxy, useReverseProxy } from './proxy'
import { UseNgrok, useNgrok } from './ngrok'

export class App {
  config: PortlessConfig
  greenlock: UseGreenlock
  reverseProxy: UseReverseProxy
  ngrok: UseNgrok

  async start (cwd: string) {
    this.config = await loadConfig(cwd)
    this.greenlock = await useGreenlock(this.config)
    if (this.config.ngrok) {
      this.ngrok = await useNgrok(this.config)
    }
    this.reverseProxy = await useReverseProxy(this.config, {
      publicKeyId: this.greenlock ? this.greenlock.publicKeyId : undefined,
    })

    if (this.reverseProxy && this.ngrok) {
      this.reverseProxy.onPublicUrl((targetUrl, publicUrl) => {
        this.ngrok.addTunnel({
          targetUrl,
          publicUrl,
        })
      })
    }

    if (this.greenlock && this.ngrok) {
      this.greenlock.onCertificateIssued(() => {
        this.ngrok.restartTunnels()
      })
    }

    consola.success(`App ${this.config.projectName} started`)
  }

  async stop () {
    if (this.greenlock) {
      await this.greenlock.destroy()
    }

    if (this.ngrok) {
      await this.ngrok.stopTunnels()
    }

    if (this.reverseProxy) {
      await this.reverseProxy.destroy()
    }

    consola.success(`App ${this.config.projectName} stopped`)
  }
}

const apps: App[] = []

export function getAppByProjectName (projectName: string) {
  return apps.find(app => app.config.projectName === projectName)
}

export function getAppByCwd (cwd: string) {
  return apps.find(app => app.config.cwd === cwd)
}

export async function addApp (cwd: string) {
  const app = new App()
  await app.start(cwd)
  apps.push(app)
  return app
}

export async function removeApp (app: App) {
  await app.stop()
  const index = apps.indexOf(app)
  if (index !== -1) apps.splice(index, 1)
}

export async function restartApp (app: App) {
  const cwd = app.config.cwd
  await app.stop()
  await app.start(cwd)
}