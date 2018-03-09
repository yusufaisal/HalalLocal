import React, { Component } from 'react';
import { View,
         Text,
         Image,
         Alert,
         Dimensions } from 'react-native';
import AppIntro from 'react-native-app-intro';
import StackNavigator from '../App';
import App from '../App';
// import App from '../App';
// import test from '../App';

const width = Dimensions.get('window').width;
const height = Dimensions.get('window').height;

export default class Intro extends Component {

    constructor(props) {
        super(props);
        // Set default value
        this.state = {
            done: false,
        }
    }

    shouldComponentUpdate() {
        return this.state.done;
    }

  // APP INTRO THINGS
//   onSkipBtnHandle = (index) => {
//     Alert.alert('SKIP');
//   }

  doneBtnHandle = () => {
        // console.log(test);
      this.setState({done: true}, this.forceUpdate());
      // return <App screenProps={{first: false}} />;
    // return <StackNavigator screenProps={{abc:true}}/>;
  }

  render() {
        console.log("render");
    return(
        this.state.done ?
            <App screenProps={{first: false}} />
                :
      <AppIntro
        dotColor={'rgba(0, 0, 0, 0.1)'}
        activeDotColor={'#13a89e'}
        rightTextColor={'#13a89e'}
        leftTextColor={'#13a89e'}
        doneBtnLabel={'done'}
        // skipBtnLabel={'skip'}
        nextBtnLabel={'next'}
        // onSkipBtnClick={this.onSkipBtnHandle}
        onDoneBtnClick={this.doneBtnHandle}
        showSkipButton={false}
        customStyles={{btnContainer: {flex: 1}}}>
        <View>
          <Image
            style={{
              height: height,
              width: width,
              resizeMode: 'cover'
            }}
            source={require('../img/intro_1.jpg')} /> 
        </View>
        <View>
          <Image
            style={{
              height: height,
              width: width,
              resizeMode: 'cover'
            }}
            source={require('../img/intro_2.jpg')} /> 
        </View>
        <View>
          <Image
            style={{
              height: height,
              width: width,
              resizeMode: 'cover'
            }}
            source={require('../img/intro_3.jpg')} /> 
        </View>
        <View>
          <Image
            style={{
              height: height,
              width: width,
              resizeMode: 'cover'
            }}
            source={require('../img/intro_4.jpg')} /> 
        </View>
      </AppIntro>
    );
  }
}