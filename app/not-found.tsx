import { Button, Chip, Icon, Logo } from "@/components/ui";
import { Footer } from "@/components/layout/Footer";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Nav } from "@/components/layout/Nav";
import styles from "./not-found.module.css";

/**
 * Custom 404. Next-only default is a tiny system message; that reads as
 * broken on a startup-shaped product page. This matches the brand's
 * coral/aqua palette and offers two ways back so a judge who mistypes
 * a URL never hits a dead end.
 */
export default function NotFound() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.logoWrap}>
            <Logo size={28} />
          </div>
          <Chip tone="outline" size="md" icon={<Icon name="bolt" size={11} color="var(--coral)" />}>
            404 · this column is empty
          </Chip>
          <h1 className={styles.title}>
            No four-in-a-row here.
          </h1>
          <p className={styles.sub}>
            The page you tried to reach doesn&apos;t exist — yet. Drop back to the
            lobby or challenge a friend by link instead.
          </p>
          <div className={styles.ctas}>
            <Button
              variant="primary"
              size="lg"
              href="/play"
              iconRight={<Icon name="arrow" size={14} />}
            >
              Back to lobby
            </Button>
            <Button
              variant="outline"
              size="lg"
              href="/"
              icon={<Icon name="home" size={14} />}
            >
              Home
            </Button>
          </div>
        </div>
      </main>
      <Footer />
      <MobileTabBar />
    </>
  );
}
