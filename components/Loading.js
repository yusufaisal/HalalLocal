// IMPORT LIBRARIES
import React from 'react';
import { View } from 'react-native';
import { SkypeIndicator } from 'react-native-indicators';
import { styles } from '../styles/loading';

export const Loading = (props) => {

  return (
    <View style = { styles.container }>
      <SkypeIndicator
        color = {props && props.color ? props.color : '#13a89e'}
        size = {props && props.size ? props.size : 40 } />
    </View>
  );
}
