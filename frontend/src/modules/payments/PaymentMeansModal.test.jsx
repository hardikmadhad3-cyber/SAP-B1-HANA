import {
  createDefaultPaymentMeans,
  validatePaymentMeans,
} from "./PaymentMeansModal";

describe("validatePaymentMeans", () => {
  test("requires an explicitly entered payment means", () => {
    expect(validatePaymentMeans(createDefaultPaymentMeans(), 1000)).toBe(
      "Enter at least one Payment Means amount.",
    );
  });

  test("requires the payment means total to match the amount due", () => {
    const means = createDefaultPaymentMeans({ cashAccount: "100000", amount: 900 });
    expect(validatePaymentMeans(means, 1000)).toBe(
      "Payment Means paid amount must match Total Amount Due.",
    );
  });

  test("requires a G/L account for the selected means", () => {
    const means = createDefaultPaymentMeans();
    means.transfer.amount = "1,000.00";
    expect(validatePaymentMeans(means, 1000)).toBe("Bank Transfer G/L Account is required.");
  });

  test("accepts a valid payment on account amount", () => {
    const means = createDefaultPaymentMeans({ cashAccount: "100000", amount: 1000 });
    expect(validatePaymentMeans(means, 1000)).toBe("");
  });

  test("accepts a paid amount as the due amount for advance payments", () => {
    const means = createDefaultPaymentMeans({ cashAccount: "100000", amount: 1200 });
    expect(validatePaymentMeans(means, 0, { allowPaidAsTotalDue: true })).toBe("");
  });
});
