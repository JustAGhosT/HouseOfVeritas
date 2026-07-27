type ProbeEnvironment = Readonly<Record<string, string | undefined>>

export function productionProbePolicy(isPostDeployProbe: boolean, isCI: boolean) {
  return {
    retries: isPostDeployProbe ? 0 : isCI ? 2 : 0,
    trace: isPostDeployProbe ? ("off" as const) : ("on-first-retry" as const),
  }
}

export function resolveProductionProbePolicy(
  environment: ProbeEnvironment,
  loadEnvironment: () => unknown
) {
  loadEnvironment()

  const isPostDeployProbe = environment.POST_DEPLOY_PROBE === "true"
  return {
    isPostDeployProbe,
    ...productionProbePolicy(isPostDeployProbe, !!environment.CI),
  }
}
