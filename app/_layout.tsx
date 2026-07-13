// ? Must be first import — patches console.warn before any RN module triggers LayoutAnimation warning
import "../lib/_warnPatch";
import { LogBox } from "react-native";
LogBox.ignoreLogs(["setLayoutAnimationEnabledExperimental"]);

import React, { useState, useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet } from "react-native";
import { ThemeProvider, useTheme } from "../lib/theme";
import { getItem } from "../lib/storage";

const FULLSCREEN_KEY = "examforge_fullscreen_mode";

function RootLayoutInner() {
  const { isDark, colors } = useTheme();
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const val = await getItem(FULLSCREEN_KEY);
        setFullscreen(val === "true");
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const val = await getItem(FULLSCREEN_KEY);
        setFullscreen(val === "true");
      } catch {}
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} hidden={fullscreen} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="api-settings" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="clear-test-history" />
        <Stack.Screen name="results-history" />
        <Stack.Screen name="ai-chat" />
        <Stack.Screen name="data-management" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

