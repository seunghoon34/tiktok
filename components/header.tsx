import Ionicons from "@expo/vector-icons/Ionicons"
import { useRouter } from "expo-router"
import { TouchableOpacity, View, Text } from "react-native"

export default function Header({ title = '', color, goBack = false}: {
  title: string, 
  color: string, 
  goBack: boolean
}) {
  const router = useRouter()
  
  return(
    <View className="flex-row items-center justify-between w-full px-4 py-2">
      <View className="w-10">
        {goBack && (
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={32} color={color}/>
          </TouchableOpacity>
        )}
      </View>
      <Text className="font-bold text-2xl" style={{ color }}>
        {title || ''} {/* Add fallback empty string */}
      </Text>
      <View className="w-10" />
    </View>
  )
}