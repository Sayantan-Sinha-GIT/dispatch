import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — Dispatch",
  description: "The terms for using Dispatch as a customer or rider.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="24 September 2026"
      intro="These terms apply when you use Dispatch, on the website or in the Android app. By creating an account or placing an order you agree to them."
      sections={[
        {
          heading: "Accounts",
          body: (
            <p>
              Give accurate details and keep your sign-in private. You are responsible for what happens under your account.
              We may suspend an account that is used to abuse the service, its riders or its customers.
            </p>
          ),
        },
        {
          heading: "Orders",
          body: (
            <ul>
              <li>Prices, stock and delivery fees are shown before you order. An order can only be placed while items are in stock.</li>
              <li>You can cancel free of charge within the cancellation window shown on the order.</li>
              <li>
                Each order has a delivery code. Give it to the rider only once you have your items; sharing it confirms
                delivery.
              </li>
              <li>If an order marked delivered never reached you, report it from the order page and we will look into it.</li>
            </ul>
          ),
        },
        {
          heading: "Riders",
          body: (
            <p>
              Riders choose when to go online and may accept or decline each offer. Payouts are calculated from the distance
              shown on each offer. Riders must follow traffic laws and deliver only to the customer at the order&apos;s
              address. Repeatedly letting offers expire can lead to a short suspension from receiving new ones.
            </p>
          ),
        },
        {
          heading: "The service",
          body: (
            <p>
              We work to keep Dispatch available and accurate, but it is provided as it is, and delivery times are estimates.
              To the extent the law allows, we are not liable for indirect losses from using it. Nothing in these terms
              limits rights you have under consumer protection law.
            </p>
          ),
        },
        {
          heading: "Your information",
          body: (
            <p>
              How we handle your information is set out in our{" "}
              <Link href="/privacy" className="text-brand underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </p>
          ),
        },
        {
          heading: "Changes and contact",
          body: (
            <p>
              We may update these terms; the date at the top shows the latest version. Questions can be sent through Support
              in the app.
            </p>
          ),
        },
      ]}
    />
  );
}
