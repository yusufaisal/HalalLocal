// Styles
import React from 'react';
import { StyleSheet } from 'react-native';
import { Font } from 'expo';

export const styles = StyleSheet.create({
    container: {
        paddingTop: 10,
        justifyContent: 'center',
    },
    carouselContainer: {
        flex: 1,
    },
    carousel: {
        // height: 175,
        backgroundColor: '#f5f5f5',
        borderColor: '#e0e0e0',
        borderBottomWidth: 1,
    },
    containerFeatures:{
        backgroundColor: 'white',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems:'center',
        paddingVertical:10,
    },
    buttonFeature:{
        backgroundColor: 'white',
        alignItems: 'center',
        height: 75,
        width: 75,
        marginHorizontal: 10,
    },
    textFeature:{
        textAlign: 'center',
        fontSize: 10,
        marginVertical: 10,
    },
    carouselResto: {
        flex:1, 
        backgroundColor: "rgba(0,0,0,0)",
        borderColor: 'black',
        height:200,
        width: "100%"
    },
    listRestoBox: {
    },
    insideRestoBox: {
        marginHorizontal: 10,
        backgroundColor: 'white',
        flexDirection:'row',
        marginVertical: 5,
        padding:10,
        borderBottomWidth: 2,
        borderBottomColor: '#555555',
        borderRadius: 5
    },
    contentContainer: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
        paddingTop: 4,
        paddingLeft: 4,
        paddingRight: 4
    },
    button: {
        marginTop: 30,
        width: "100%",
        alignItems: 'center',
        backgroundColor: '#fff'
    },
    buttonText: {
        padding: 20,
        color: 'black',
    },
    SubText: {
        paddingTop:22,
        paddingRight: 10,
    },
    buttonSubText: {
        alignItems: 'flex-end',
    },
    Text: {
        color: '#13a89e',
        fontSize: 12
    },
    buttonDirection:{
        height: 25,
        paddingHorizontal: 5,
        backgroundColor: '#13a89e',
        position:'absolute',
        alignSelf: 'flex-end',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 105,
        borderRadius: 5,
        opacity: 1
        
    },
    buttonDirection2:{
        width: '100%', height: 25,paddingTop: 6, 
        backgroundColor: '#13a89e',
        borderRadius: 50,
        marginTop: 10,
    },
    buttonTextDirection:{
        fontSize:12,
        color: 'white',
        fontWeight: 'bold',
    },
    buttonTextStyle:{
        justifyContent: 'center',
        alignItems: 'center',
    },
    listFeatures: {
        marginTop: 10,
        backgroundColor: '#fff',
        paddingBottom: 10
    },
    titleList: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        justifyContent: 'space-between',  
    },
    titleText: {
        padding: 20,
        color: 'black',
        fontWeight: "bold",
        fontSize: 16, 
    },
    container2: {
        paddingTop: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    container3: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff'
    },
    button2: {
        marginBottom: 10,
        width: 260,
        alignItems: 'center',
        backgroundColor: '#2196F3'
    },
    buttonText2: {
        padding: 10,
        color: 'white'
    },
    widget: {
        height: 150,
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        // marginBottom: 4
    },
   titlePrayer:{
    fontWeight: "bold", 
    color:'white'
   },
   alignPrayer: {
    flex: 1,
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: 'transparent',
    height: 50
   },

});