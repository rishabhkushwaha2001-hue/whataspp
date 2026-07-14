import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Platform } from 'react-native';
import { useTheme } from '../../src/theme/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const { colors, theme } = useTheme();
  const [businessType, setBusinessType] = useState('gym');
  const isDark = theme === 'dark';

  useEffect(() => {
    const fetchType = async () => {
      const bType = await AsyncStorage.getItem('businessType');
      if (bType) setBusinessType(bType);
    };
    fetchType();
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6C4DFF',
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: isDark ? '#171A22' : 'white',
          borderTopColor: isDark ? '#2A2D3A' : '#E2E8F0',
          height: Platform.OS === 'ios' ? 85 : 70,
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          paddingTop: 10,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: 'Members',
          tabBarIcon: ({ color }) => <TabBarIcon name="users" color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="enroll"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => (
            <View style={{
              top: Platform.OS === 'ios' ? -10 : -20,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <LinearGradient
                colors={['#6C4DFF', '#4F46E5']}
                start={{x: 0, y: 0}} end={{x: 1, y: 1}}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  justifyContent: 'center',
                  alignItems: 'center',
                  shadowColor: '#6C4DFF',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.4,
                  shadowRadius: 16,
                  elevation: 8,
                }}
              >
                <FontAwesome name="plus" size={24} color="#fff" />
              </LinearGradient>
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="dues"
        options={{
          title: 'Payments',
          tabBarIcon: ({ color }) => <TabBarIcon name="credit-card" color={color} />,
        }}
      />

      <Tabs.Screen
        name="seats"
        options={{
          title: 'Seats',
          href: businessType === 'library' ? '/seats' : null,
          tabBarIcon: ({ color }) => <TabBarIcon name="th" color={color} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <TabBarIcon name="list-ul" color={color} />,
        }}
      />

      <Tabs.Screen
        name="feedback"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
