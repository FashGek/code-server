import { field, logger } from "@coder/logger"
import { Router } from "express"
import { promises as fs } from "fs"
import * as path from "path"
import { Readable } from "stream"
import * as tarFs from "tar-fs"
import * as zlib from "zlib"
import { HttpCode, HttpError } from "../../common/http"
import { DefaultedArgs } from "../cli"
import { rootPath } from "../constants"
import { asyncRoute, authenticated, replaceTemplates } from "../http"
import { memo, getMediaMime, pathToFsPath } from "../util"

const router = Router()

const route = (args: DefaultedArgs): Router => {
  router.get(
    // The commit is for caching.
    "/:commit*",
    asyncRoute(async (req, res) => {
      const resourcePath = path.resolve(req.params[0])

      // Make sure it's in code-server if you aren't authenticated. This lets
      // unauthenticated users load the login assets.
      if (!resourcePath.startsWith(rootPath) && !authenticated(args.auth, req, args.password)) {
        throw new HttpError("Unauthorized", HttpCode.Unauthorized)
      }

      // Don't cache during development. - can also be used if you want to make a
      // static request without caching.
      if (req.params.commit !== "development" && req.params.commit !== "-") {
        res.header("Cache-Control", "public, max-age=31536000")
      }

      const tar = Array.isArray(req.query.tar) ? req.query.tar[0] : req.query.tar
      if (typeof tar === "string") {
        let stream: Readable = tarFs.pack(pathToFsPath(tar))
        if (req.headers["accept-encoding"] && req.headers["accept-encoding"].includes("gzip")) {
          logger.debug("gzipping tar", field("path", resourcePath))
          const compress = zlib.createGzip()
          stream.pipe(compress)
          stream.on("error", (error) => compress.destroy(error))
          stream.on("close", () => compress.end())
          stream = compress
          res.header("content-encoding", "gzip")
        }
        res.set("Content-Type", "application/x-tar")
        stream.on("close", () => res.end())
        return stream.pipe(res)
      }

      res.set("Content-Type", getMediaMime(resourcePath))

      if (resourcePath.endsWith("manifest.json")) {
        const content = await fs.readFile(resourcePath, "utf8")
        return res.send(replaceTemplates(req, content))
      }

      const content = await fs.readFile(resourcePath)
      return res.send(content)
    }),
  )

  return router
}

export = memo(route)
