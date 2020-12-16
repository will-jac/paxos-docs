import React from 'react';
import Editor from './editor/Editor';


export default function App(props) {
  return (<Editor peer={props.peer}/>)
}
