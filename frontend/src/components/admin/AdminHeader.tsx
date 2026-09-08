import Header from "@/components/Header";

interface AdminHeaderProps {
  /**
   * Accepted and ignored.
   *
   * The admin bar used to print the name of the current screen on its left.
   * That is gone: the panel now carries the same menu bar as the rest of the
   * site, and the bar has no room for a page title. Nine screens still pass
   * one, so the prop stays rather than making this a nine-file change — the
   * sidebar already marks which page is open.
   */
  title?: string;
}

/**
 * The admin panel's top bar.
 *
 * Nothing of its own any more: it is the site's menu bar, in admin mode. The
 * bar handles what the panel needs — the sidebar trigger on the screens where
 * that sidebar is hidden, and an account menu pointing at admin destinations.
 */
export const AdminHeader = (_props: AdminHeaderProps) => <Header admin dark />;

export default AdminHeader;
