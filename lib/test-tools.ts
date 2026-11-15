/** Testing helpers (role reset, roles granted at once) are on only when GAIT_TEST_TOOLS=1. Never set it where real people sign in. */
export function testToolsOn(): boolean {
  return process.env.GAIT_TEST_TOOLS === "1";
}
