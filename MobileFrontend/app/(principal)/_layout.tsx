import { Tabs } from "expo-router";

// Tabs principales de la app
export default function LayoutPrincipal() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="mapa" options={{ title: "Mapa" }} />
      <Tabs.Screen name="ranking" options={{ title: "Ranking" }} />
      <Tabs.Screen name="grupos" options={{ title: "Grupos" }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
    </Tabs>
  );
}