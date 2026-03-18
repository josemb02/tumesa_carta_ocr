import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

/*
 * Layout de la zona principal de BeerMap.
 * Tab bar con iconos y estilo coherente con la app.
 */
export default function LayoutPrincipal() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: "#10233E",
                    borderTopWidth: 0,
                    height: 64,
                    paddingBottom: 10,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: "#F7C948",
                tabBarInactiveTintColor: "#6B85A8",
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: "600",
                },
            }}
        >
            <Tabs.Screen
                name="mapa"
                options={{
                    title: "Mapa",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="map" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="ranking"
                options={{
                    title: "Ranking",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="trophy" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="grupos"
                options={{
                    title: "Grupos",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="people" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="perfil"
                options={{
                    title: "Perfil",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="person" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}