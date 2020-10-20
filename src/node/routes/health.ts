import { Router } from "express"
import { Heart } from "../heart"
import { memo } from "../util"

const route = (heart: Heart): Router => {
  const router = Router()

  router.get("/", (_, res) => {
    res.json({
      status: heart.alive() ? "alive" : "expired",
      lastHeartbeat: heart.lastHeartbeat,
    })
  })
  return router
}

export = memo(route)
