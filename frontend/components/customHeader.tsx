import Ionicons from "@expo/vector-icons/Ionicons"
import { useRouter } from "expo-router"
import { TouchableOpacity, View, Text, GestureResponderEvent } from "react-native"

export default function CustomHeader({ title = '', color, onpress}: {
  title: string, 
  color: string, 
  onpress: (event: GestureResponderEvent) => void
}) {
  const router = useRouter()
  
  return(
    <View className="flex-row items-center justify-between w-full px-4 py-2">
      <View className="w-10">
        
          <TouchableOpacity onPress={onpress}>
            <Ionicons name="chevron-back" size={32} color={color}/>
          </TouchableOpacity>
    
      </View>
      <Text className="font-bold text-2xl" style={{ color }}>
        {title || ''} {/* Add fallback empty string */}
      </Text>
      <View className="w-10" />
    </View>
  )
}