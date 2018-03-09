import React from 'react';
import { View, StatusBar } from 'react-native';

export const StatBar = () => {
    return(
        <View
            style={{
                backgroundColor: '#00796b',
                height: StatusBar.currentHeight
            }}>
        </View>
    );
}