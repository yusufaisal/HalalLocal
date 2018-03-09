import React from 'react';
import { View, Text, Image, Dimensions } from 'react-native';

const width=Dimensions.get('window').width;

export const Toolbar = (props) => {
  return (
    <View>
      <Image
        source={require('../img/header.jpg')}
        style={{
            headerContainer: {
                width: width,
                height: 56,
                position: 'absolute',
                borderColor: '#e0e0e0',
                borderBottomWidth: 1
            }
        }} />
      <Text
        style={{
            color: '#fff',
            fontSize: 20,
            fontWeight: 'bold',
            alignSelf: 'center',
            marginTop: 16,
            marginBottom: 16
        }}>{props.headerTitle}</Text>
    </View>
  );
}
