import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Dispatch",
  description: "What Dispatch collects, why, who it is shared with, and how to have it deleted.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="24 September 2026"
      intro="Dispatch is a local delivery service: customers order groceries, riders deliver them, and an operations team runs the dispatch. This policy explains what we collect to do that, why, and what you can ask us to do with it. It covers the website at dispatch-delivery.vercel.app and the Dispatch Android app, which shows the same site."
      sections={[
        {
          heading: "What we collect",
          body: (
            <ul>
              <li>
                <strong>Account details:</strong> your name, email address and, if you give it, your phone number. If you
                sign in with Google, we receive your name, email address and profile picture from Google. We never see your
                Google password.
              </li>
              <li>
                <strong>Orders:</strong> what you ordered, the delivery address you type, the point you place on the map,
                amounts, and the order&apos;s status history.
              </li>
              <li>
                <strong>Rider location:</strong> while a rider is online, their device&apos;s location is shared so the
                nearest rider can be offered each order and customers can follow their delivery. Nothing is collected while a
                rider is offline.
              </li>
              <li>
                <strong>Your location, if you allow it:</strong> customers can use their current position to fill in a
                delivery address. It is used for that address only.
              </li>
              <li>
                <strong>Support messages</strong> you send about an order, and the replies.
              </li>
              <li>
                <strong>Preferences</strong> such as language and light or dark theme, kept on your own device.
              </li>
            </ul>
          ),
        },
        {
          heading: "How we use it",
          body: (
            <ul>
              <li>To create your account and keep you signed in.</li>
              <li>To take, route, deliver and track orders, and to pay riders for the distance they cover.</li>
              <li>To answer support requests and resolve problems with an order.</li>
              <li>To keep the service secure and prevent misuse.</li>
            </ul>
          ),
        },
        {
          heading: "Who can see it",
          body: (
            <>
              <p>
                A rider sees the delivery address and map point of the orders offered or assigned to them. A customer sees
                the assigned rider&apos;s name and live position while their order is on the way. The operations team can
                see orders, accounts and rider positions to run the service.
              </p>
              <p>
                We do not sell your information or use it for advertising. These providers run parts of Dispatch and process
                data only on our behalf:
              </p>
              <ul>
                <li>
                  <strong>Supabase:</strong> database, sign-in and file storage.
                </li>
                <li>
                  <strong>Vercel:</strong> hosting the website.
                </li>
                <li>
                  <strong>Google:</strong> &ldquo;Sign in with Google&rdquo;, and Google Gemini, which reads order text
                  that the operations team pastes into the console.
                </li>
                <li>
                  <strong>OpenStreetMap:</strong> map images, and turning addresses into map points. The Navigate button
                  opens Google Maps, whose own privacy policy then applies.
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: "How long we keep it",
          body: (
            <p>
              Account details are kept while your account exists. Order records are kept as long as they are needed for
              deliveries, support, rider payouts and our legal obligations. A rider&apos;s latest position is overwritten as
              they move rather than stored as a history.
            </p>
          ),
        },
        {
          heading: "Your choices",
          body: (
            <ul>
              <li>
                You can turn location access off at any time in your phone or browser settings. Riders cannot receive orders
                without it.
              </li>
              <li>
                You can ask us to correct your details, or to delete your account and its personal data, through Support in
                the app. Some order records may be kept where the law requires it.
              </li>
            </ul>
          ),
        },
        {
          heading: "Children",
          body: <p>Dispatch is not meant for children under 18, and we do not knowingly collect their information.</p>,
        },
        {
          heading: "Changes and contact",
          body: (
            <p>
              If this policy changes, the date at the top changes with it. For any question about your information, contact
              us through Support in the app.
            </p>
          ),
        },
      ]}
    />
  );
}
