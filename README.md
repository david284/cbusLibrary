# cbusLibrary
Library for decoding and encoding CBUS Layout Control Bus (LCB) messages. 
There is a very comprehensive set of tests for this - see ## tests section further below. 
The decoding and encoding follows the CBUS specification available here 
<a href="https://www.merg.org.uk/merg_wiki/doku.php?id=public:cbuspublic:developerguide">CBUS dev guide</a>

<a href="cbusLibrary.html">cbusLibrary API</a>

## Installation

    npm install cbuslibrary

   (note all lower case - npm no longer allows uppercase)

## usage

    const cbusLib = require('cbusLibrary')
An instance of the class is created automatically, so can be used immediately

for decoding, there's one common function (as the opcode is embedded in the message)
    var cbusMsg = cbusLib.decode(<message to be decoded>)
    
for encoding, each opCode has it's own function, as the type & number of parameters vary with opCode
    var encode = cbusLib.encodeEVLRN(nodeNumber, eventNumber, VariableIndex, eventVariableValue);

The decode function returns a collection of values, with "encoded", "mnemonic", "opCode" and "text" being standard for all opCodes
See an expanded description of 'eventName' further below

example decode:

    {
      "encoded": ":SB780ND200010000FF00;",
      "mnemonic": "EVLRN",
      "opCode": "D2",
      "nodeNumber": 1,
      "eventNumber": 0,
      "eventName": "00010000",
      "eventVariableIndex": 255,
      "eventVariableValue": 0,
      "text": "EVLRN (D2) nodeNumber 1 eventNumber 0 eventName 00010000 Event Variable Index 255 Event Variable Value 0"
    }
    
Note that some properties have full names to avoid confusion (e.g. eventVariableIndex, rather than EV#)

Look at the test file to see examples of usage for all opCodes
    mergAdminNode.spec.js
    
## eventName

Typically, in a message the node number represents the sending module of the message
For 'learning' opCodes, the node/event number combination can represent the event identity stored (or to be stored) in the event table
'eventName' is a property (in addition to nodeNumber & eventNumber) that holds the node/event number combination in hexadecimal format
This can be easier to use in code to uniquely identify an entry in the stored event table (as opposed to an actual message on the CAN bus)
Note that the encode function still requires the individual node & event numbers, this only applies to decodes of specific opCodes

First implemented for the following opCodes
95 EVULN - remove event
B2 REQEV - read event variable in learn mode
D2 EVLRN - teach event
D3 EVANS - response to REQEV
F2 ENRSP - uses 4 byte eventName as well as nodeNumber
F5 EVLRNI - teach event with index

## CAN header

There are default values for the CAN header used when encoding messages, but these can be changed using the following function

    setCanHeader(MjPri, CAN_ID)
    
Once set, the new values will continue to be used for subsequent encodes (or until the program is restarted)
    
Note that MinPri is specifically defined for each opCode, so is set for each individual opCode and not expected to be changed

## tests

There is a comprehensive suite of unit tests for all the opCodes

Run all tests
    npm test
Will run al the tests - note there are more than 18,000 tests, and although doesn't take too long, it does create a huge log file

You can also run tests for a specific opCode, which produces a much more workable log file
    npm test -- --grep "EVLRN"

The log file is created in /tests/logs, and is overwritten on each test run






