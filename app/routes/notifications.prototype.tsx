// PROTOTYPE — throwaway (branch prototype/notifications-ui). The full
// /notifications page; data comes from the app layout's loader.
import { useRouteLoaderData } from "react-router";
import type { loader as layoutLoader } from "./layout.app";
import {
  NotificationsPage,
  usePrototypeState,
} from "~/components/notifications-prototype/variants";

export default function NotificationsPrototypeRoute() {
  const data = useRouteLoaderData<typeof layoutLoader>("routes/layout.app");
  const proto = usePrototypeState();
  const items = proto.empty ? [] : (data?.prototypeNotifications ?? []);
  return <NotificationsPage items={items} variant={proto.variant} />;
}
