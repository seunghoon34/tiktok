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
    <View className="flex-row items-center justify-between w-full px-4 py-3">
      <View className="w-10">
        {goBack && (
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.6}>
            <Ionicons name="chevron-back" size={28} color={color}/>
          </TouchableOpacity>
        )}
      </View>
      <Text className="text-ios-title3 font-semibold" style={{ color }}>
        {title || ''}
      </Text>
      <View className="w-10" />
    </View>
  )
}