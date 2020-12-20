# cbusLibrary
### Library for decoding and encoding CBUS Layout Control Bus (LCB) messages, including extended messages used for firmware download
There is a very comprehensive set of tests for this - see <strong>tests</strong> section further below. <br>
The decoding and encoding of standard (11 bit) CAN ID messages follows the CBUS specification available here 
<a href="https://www.merg.org.uk/merg_wiki/doku.php?id=public:cbuspublic:developerguide">CBUS dev guide</a><br>
At the time of writing, there isn't a formal definition of extended (29 bit) CAN ID message formats, so the methods are based on current implementations

<h3>Full API details available <a href="cbusLibrary.html">here</a></h3>

## Installation
    npm install cbuslibrary
   (note all lower case - npm no longer allows uppercase)
## Usage
    const cbusLib = require('cbusLibrary')
An instance of the class is created automatically, so can be used immediately

## General information

### decoding
for decoding, there's one common function (as the opcode is embedded in the message)
    var cbusMsg = cbusLib.decode(<message to be decoded>)
    
The decode function returns a collection of values, with "encoded", "ID_TYPE" and "text" being standard for all messages
See an expanded description of 'eventName' further below

example CBUS (11 bit Id) message decode:

    {
      "encoded": ":SB780ND200010000FF00;",
      "ID_TYPE":"S",
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

example extended (29 bit Id) message decode:

    {
        "encoded":":X00080004N000000000D040000;",
        "ID_TYPE":"X",
        "operation":"PUT",
        "type":"CONTROL",
        "address":"000000",
        "RESVD":0,
        "CTLBT":13,
        "SPCMD":4,
        "CPDTL":0,
        "CPDTH":0
        "text": {"encoded":":X00080004N000000000D040000;","ID_TYPE":"X","operation":"PUT","type":"CONTROL","address":"000000","RESVD":0,"CTLBT":13,"SPCMD":4,"CPDTL":0,"CPDTH":0}
    }

    

### encoding
for encoding, each format of message has it's own function, as the type & number of parameters vary with opCode
<ul style="list-style-type:none;"><li>var encode = cbusLib.encodeEVLRN(nodeNumber, eventNumber, VariableIndex, eventVariableValue);</li></ul>

## eventName
Typically, in a message the node number represents the sending module of the message. 
For 'learning' opCodes, the node/event number combination can represent the event identity stored (or to be stored) in the event table<br>
'eventName' is a decode function property (in addition to nodeNumber & eventNumber) that holds the node/event number combination in hexadecimal format. 
This can be easier to use in code to uniquely identify an entry in the stored event table (as opposed to an actual message on the CAN bus)<br>
Note that the encode functions still requires the individual node & event numbers, this only applies to decodes of specific opCodes<br>
The exception to this is the encode for 'ENRSP' which expects the four byte eventName as well as the node number<br>

<ul style="list-style-type:none;">
<li>First implemented in the decodes for the following opCodes</li>
<li>B2 REQEV - read event variable in learn mode</li>
<li>D2 EVLRN - teach event</li>
<li>D3 EVANS - response to REQEV</li>
<li>F2 ENRSP - encode also uses 4 byte eventName as well as nodeNumber</li>
<li>F5 EVLRNI - teach event with index</li>
</ul>

### CAN header (11 bit CAN identifier)

There are default values for the 11 bit CAN header used when encoding messages, but these can be changed using the following function

<ul style="list-style-type:none;"><li>setCanHeader(MjPri, CAN_ID)</li></ul>
  
Once set, the new values will continue to be used for subsequent encodes (or until the program is restarted)<br>
    
Note that MinPri is specifically defined for each opCode, so is set for each individual opCode and not expected to be changed

### CAN header (29 bit CAN identifier)

The absence of a definition for the 29 bit identifier means that the identifier is hard coded to match existing 
<ul style="list-style-type:none;">
<li>0000N000&ltA&gt for FCO originated messages</li>
<li>8000N000&ltA&gt for module originated messages</li>
</ul>
where: &ltA&gt is a bit mapped character, bit 0 being control/data, and bit 1 being put/get

## Tests

There is a comprehensive suite of unit tests for all the message decode/encodes, which also create a log file

### Run all tests
<ul style="list-style-type:none;"><li>npm test</li></ul>
Will run al the tests - note there are more than 18,000 tests, and although doesn't take too long, it does create a huge log file

### Run specific test
You can also run a specific test, which produces a much more workable log file
<ul style="list-style-type:none;"><li>npm test -- --grep "EVLRN"</li></ul>

### Tests log file
For all tests, the log file is created in /tests/logs, and is overwritten on each test run






