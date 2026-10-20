import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

// The single .env lives at the repository root (docs/design/RUNBOOK.md §4); Next only looks in apps/web.
nextEnv.loadEnvConfig(fileURLToPath(new URL("../..", import.meta.url)));

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
