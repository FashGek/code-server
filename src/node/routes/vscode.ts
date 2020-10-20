import { Router } from "express"
import { promises as fs } from "fs"
import { DefaultedArgs } from "../cli"
import { commit, rootPath } from "../constants"
import { asyncRoute, authenticated, redirect } from "../http"
import { memo } from "../util"
import { VscodeProvider } from "../vscode"
import { settings } from "../settings"
import {
  CodeServerMessage,
  Options,
  Query,
  StartPath,
  VscodeMessage,
  VscodeOptions,
  WorkbenchOptions,
} from "../../../lib/vscode/src/vs/server/ipc"

const router = Router()
const vscode = new VscodeProvider()

/**
 * Choose the first non-empty path.
 */
const getFirstPath = (
  startPaths: Array<{ url?: string | string[]; workspace?: boolean } | undefined>,
): Promise<StartPath | undefined> => {
  const isFile = async (path: string): Promise<boolean> => {
    try {
      const stat = await fs.stat(path)
      return stat.isFile()
    } catch (error) {
      logger.warn(error.message)
      return false
    }
  }
  for (let i = 0; i < startPaths.length; ++i) {
    const startPath = startPaths[i]
    const url = arrayify(startPath && startPath.url).find((p) => !!p)
    if (startPath && url) {
      return {
        url,
        // The only time `workspace` is undefined is for the command-line
        // argument, in which case it's a path (not a URL) so we can stat it
        // without having to parse it.
        workspace: typeof startPath.workspace !== "undefined" ? startPath.workspace : await isFile(url),
      }
    }
  }
  return undefined
}

const route = (args: DefaultedArgs): Router => {
  router.get(
    "/",
    asyncRoute(async (req, res) => {
      if (!authenticated(args.auth, req, args.password)) {
        return redirect(req, res, "login", {
          to: req.baseUrl || "/",
        })
      }

      const remoteAuthority = request.headers.host as string
      const { lastVisited } = await settings.read()
      const startPath = await vscode.getFirstPath([
        { url: route.query.workspace, workspace: true },
        { url: route.query.folder, workspace: false },
        this.args._ && this.args._.length > 0 ? { url: path.resolve(this.args._[this.args._.length - 1]) } : undefined,
        lastVisited,
      ])

      const [response, options] = await Promise.all([
        await fs.readFile(rootPath, "src/browser/pages/vscode.html"),
        vscode.initialize({
          args,
          remoteAuthority,
          startPath,
        }).catch((error) => {
          const devMessage = commit === "development" ? "It might not have finished compiling." : ""
          throw new Error(`VS Code failed to load. ${devMessage} ${error.message}`)
        }),
      ])

      settings.write({
        lastVisited: startPath || lastVisited, // If startpath is undefined, then fallback to lastVisited
        query: route.query,
      })

      if (commit !== "development") {
        response.content = response.content.replace(/<!-- PROD_ONLY/g, "").replace(/END_PROD_ONLY -->/g, "")
      }

      return res.send("hello")
    }),
  )

  return router
}

export = memo(route)
