import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
it("permits publication only after successful explicitly opted-in dispatch", () => {
  const workflow = readFileSync(".github/workflows/windows.yml", "utf8");
  const release = workflow.slice(
    workflow.indexOf("      - name: Publish immutable"),
  );
  expect(release).toContain(
    "if: success() && github.event_name == 'workflow_dispatch' && inputs.publish_release",
  );
  expect(release).not.toContain("head_commit");
  expect(release).not.toContain("continue-on-error");
  expect(release).toContain("git ls-remote --exit-code --tags");
  expect(workflow.indexOf("Upload versioned Windows portable")).toBeLessThan(
    workflow.indexOf("Publish immutable"),
  );
});
