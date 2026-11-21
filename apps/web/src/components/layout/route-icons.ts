import Activity from "~/components/icons/activity";
import Building2 from "~/components/icons/building-2";
import ChartColumn from "~/components/icons/chart-column";
import House from "~/components/icons/house";
import type { IconComponent } from "~/components/icons/icon-base";
import Inbox from "~/components/icons/inbox";
import Info from "~/components/icons/info";
import LayoutDashboard from "~/components/icons/layout-dashboard";
import Moneybag from "~/components/icons/moneybag";
import Package from "~/components/icons/package";
import Phone from "~/components/icons/phone";
import Search from "~/components/icons/search";
import Settings from "~/components/icons/settings";
import Target from "~/components/icons/target";
import User from "~/components/icons/user";
import UserRound from "~/components/icons/user-round";
import Users from "~/components/icons/users";
import type { RouteIcon } from "~/domain/navigation/config";

export const ICON_BY_ROUTE: Record<RouteIcon, IconComponent> = {
  search: Search,
  settings: Settings,
  team: Users,
  fulfillment: Package,
  leads: User,
  contacts: Phone,
  campaigns: Target,
  cases: Inbox,
  companies: Building2,
  reports: ChartColumn,
  "rate-simulator": Moneybag,
  home: House,
  audit: Info,
  capacity: Activity,
  profile: UserRound,
  dashboards: LayoutDashboard,
};
