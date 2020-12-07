import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import PeerMessenger from './paxos2/PMMCMessenger';

import reportWebVitals from './reportWebVitals';

const peer = new PeerMessenger()

ReactDOM.render(
  <React.StrictMode>
    <App peer={peer}/>
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
