import { Router } from "express"
import { DefaultedArgs } from "../cli"
import { version } from "../constants"
import { asyncRoute, ensureAuthenticated } from "../http"
import { UpdateProvider } from "../update"
import { memo } from "../util"

const router = Router()
const provider = new UpdateProvider()

const route = (args: DefaultedArgs): Router => {
  router.use((req, _, next) => {
    ensureAuthenticated(args.auth, req, args.password)
    next()
  })

  router.get(
    "/",
    asyncRoute(async (_, res) => {
      const update = await provider.getUpdate()
      res.json({
        checked: update.checked,
        latest: update.version,
        current: version,
        isLatest: provider.isLatestVersion(update),
      })
    }),
  )

  // This route will force a check.
  router.get(
    "/check",
    asyncRoute(async (_, res) => {
      const update = await provider.getUpdate(true)
      res.json({
        checked: update.checked,
        latest: update.version,
        current: version,
        isLatest: provider.isLatestVersion(update),
      })
    }),
  )

  return router
}

export = memo(route)
