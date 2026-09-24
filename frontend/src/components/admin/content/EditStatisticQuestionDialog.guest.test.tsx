import { fireEvent, render, screen } from "@testing-library/react";

import { EditStatisticQuestionDialog } from "./EditStatisticQuestionDialog";
import { visibleWithoutRegistrationFor } from "@/lib/guestVisibility";

const mutate = jest.fn();
jest.mock("@/hooks/useUpdateStatisticQuestion", () => ({
  useUpdateStatisticQuestion: () => ({ mutate, isPending: false }),
}));

/**
 * "Visible without registration?" in the admin's statistic dialog — the field
 * the client's design had and the dialog did not.
 */
describe("Visible without registration?", () => {
  beforeEach(() => mutate.mockClear());

  const open = (question: Record<string, unknown>) =>
    render(
      <EditStatisticQuestionDialog
        open
        onOpenChange={() => {}}
        question={{ id: "q1", answer_type: "TEXT", question: "Conversion Rate", ...question } as any}
      />,
    );
  const pressed = (name: string) =>
    screen.getByRole("button", { name }).getAttribute("aria-pressed") === "true";

  it("shows what is in force for a question nobody has set", () => {
    open({ question: "Returning customers", visibleWithoutRegistration: null });
    expect(pressed("Yes")).toBe(true);
  });

  it("shows No for any other statistic nobody has set", () => {
    open({ question: "Conversion Rate" });
    expect(pressed("No")).toBe(true);
  });

  it("sends the choice with the rest of the question", () => {
    open({ question: "Conversion Rate", visibleWithoutRegistration: false });
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    fireEvent.click(screen.getByRole("button", { name: "Update Question" }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "q1", visibleWithoutRegistration: true }),
      expect.anything(),
    );
  });
});

describe("the default before anyone chooses", () => {
  it("is the rule the server applied in code", () => {
    expect(visibleWithoutRegistrationFor({ question: "Refund Rate" })).toBe(true);
    expect(visibleWithoutRegistrationFor({ question: "Returning customers" })).toBe(true);
    expect(visibleWithoutRegistrationFor({ question: "Average order value" })).toBe(false);
  });

  it("gives way to an administrator's choice", () => {
    expect(
      visibleWithoutRegistrationFor({ question: "Refund Rate", visibleWithoutRegistration: false }),
    ).toBe(false);
  });
});
