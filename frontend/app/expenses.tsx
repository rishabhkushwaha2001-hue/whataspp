import { Redirect } from 'expo-router';
export default function Expenses() {
  return <Redirect href={'/(tabs)' as any} />;
}
