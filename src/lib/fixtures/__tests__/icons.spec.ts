import * as lucide from "lucide-react";
import { ICONS } from "../icons";

describe("ICONS", () => {
  it("maps every known icon name to a lucide-react component", () => {
    const expected: Record<string, unknown> = {
      box: lucide.Box,
      lock: lucide.Lock,
      gear: lucide.Settings,
      bell: lucide.Bell,
      database: lucide.Database,
      layers: lucide.Layers,
      globe: lucide.Globe,
      hexagon: lucide.Hexagon,
      clock: lucide.Clock,
      shield: lucide.Shield,
      zap: lucide.Zap,
      circle: lucide.Circle,
      braces: lucide.Braces,
      package: lucide.Package,
      route: lucide.Route,
      creditCard: lucide.CreditCard,
      gauge: lucide.Gauge,
      gem: lucide.Gem,
    };

    expect(Object.keys(ICONS).sort()).toEqual(Object.keys(expected).sort());
    for (const [name, component] of Object.entries(expected)) {
      expect(ICONS[name]).toBe(component);
    }
  });

  it("has no undefined entries", () => {
    for (const component of Object.values(ICONS)) {
      expect(component).toBeDefined();
    }
  });
});
