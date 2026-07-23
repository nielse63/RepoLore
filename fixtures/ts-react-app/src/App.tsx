import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Greeting } from "./components/Greeting";

export function App() {
  return (
    <div>
      <Header userName="Repo Lore" />
      <Greeting label="Fixture app body." />
      <Footer />
    </div>
  );
}
