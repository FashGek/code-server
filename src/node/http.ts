import { field, logger } from "@coder/logger"
import { Handler, Request, Response } from "express"
import qs from "qs"
import safeCompare from "safe-compare"
import { HttpCode, HttpError } from "../common/http"
import { normalize, Options } from "../common/util"
import { AuthType } from "./cli"
import { commit, rootPath } from "./constants"
import { Heart } from "./heart"
import { hash } from "./util"

export interface Locals {
  heart: Heart
}

/**
 * Wrap asynchronous routes so rejections aren't lost to the ether.
 */
export const asyncRoute = (route: Handler): Handler => (req, res, next) =>
  Promise.resolve(route(req, res, next)).catch(next)

/**
 * Replace common variable strings in HTML templates.
 */
export const replaceTemplates = <T extends object>(
  req: Request,
  content: string,
  extraOpts?: Omit<T, "base" | "csStaticBase" | "logLevel">,
): string => {
  const base = relativeRoot(req)
  const options: Options = {
    base,
    csStaticBase: base + "/static/" + commit + rootPath,
    logLevel: logger.level,
    ...extraOpts,
  }
  return content
    .replace(/{{TO}}/g, (typeof req.query.to === "string" && req.query.to) || "/dashboard")
    .replace(/{{BASE}}/g, options.base)
    .replace(/{{CS_STATIC_BASE}}/g, options.csStaticBase)
    .replace(/"{{OPTIONS}}"/, `'${JSON.stringify(options)}'`)
}

/**
 * Throw an error if not authorized.
 */
export const ensureAuthenticated = (auth: AuthType, req: Request, password?: string): void => {
  if (!authenticated(auth, req, password)) {
    throw new HttpError("Unauthorized", HttpCode.Unauthorized)
  }
}

/**
 * Return true if authenticated via cookies.
 */
export const authenticated = (auth: AuthType, req: Request, password: string | undefined): boolean => {
  switch (auth) {
    case AuthType.None:
      return true
    case AuthType.Password:
      // The password is stored in the cookie after being hashed.
      return password && req.cookies.key && safeCompare(req.cookies.key, hash(password))
    default:
      throw new Error(`Unsupported auth type ${auth}`)
  }
}

/**
 * Get the relative path that will get us to the root of the page. For each
 * slash we need to go up a directory. For example:
 * / => .
 * /foo => .
 * /foo/ => ./..
 * /foo/bar => ./..
 * /foo/bar/ => ./../..
 */
export const relativeRoot = (req: Request): string => {
  const depth = (req.originalUrl.split("?", 1)[0].match(/\//g) || []).length
  return normalize("./" + (depth > 1 ? "../".repeat(depth - 1) : ""))
}

export type Query = { [key: string]: string | string[] | undefined }

/**
 * Redirect relatively to `/${to}`. Query variables will be preserved.
 * `override` will merge with the existing query (use `undefined` to unset).
 */
export const redirect = (req: Request, res: Response, to: string, override: Query = {}): void => {
  const query = Object.assign({}, req.query, override)
  Object.keys(override).forEach((key) => {
    if (typeof override[key] === "undefined") {
      delete query[key]
    }
  })

  const relativePath = normalize(`${relativeRoot(req)}/${to}`, true)
  const queryString = qs.stringify(query)
  const redirectPath = `${relativePath}${queryString ? `?${queryString}` : ""}`
  logger.debug(`redirecting from ${req.originalUrl} to ${redirectPath}`)
  res.redirect(redirectPath)
}

/**
 * Get the domain for a cookie. This is so we can set a cookie on a parent
 * domain when logging in with a proxy domain so the user only has to log in
 * once.
 */
export const getCookieDomain = (host: string, proxyDomains: string[]): string | undefined => {
  const idx = host.lastIndexOf(":")
  host = idx !== -1 ? host.substring(0, idx) : host
  if (
    // Might be blank/missing, so there's nothing more to do.
    !host ||
    // IP addresses can't have subdomains so there's no value in setting the
    // domain for them. Assume anything with a : is ipv6 (valid domain name
    // characters are alphanumeric or dashes).
    host.includes(":") ||
    // Assume anything entirely numbers and dots is ipv4 (currently tlds
    // cannot be entirely numbers).
    !/[^0-9.]/.test(host) ||
    // localhost subdomains don't seem to work at all (browser bug?).
    host.endsWith(".localhost") ||
    // It might be localhost (or an IP, see above) if it's a proxy and it
    // isn't setting the host header to match the access domain.
    host === "localhost"
  ) {
    logger.debug("no valid cookie doman", field("host", host))
    return undefined
  }

  proxyDomains.forEach((domain) => {
    if (host.endsWith(domain) && domain.length < host.length) {
      host = domain
    }
  })

  logger.debug("got cookie doman", field("host", host))
  return host ? `Domain=${host}` : undefined
}
