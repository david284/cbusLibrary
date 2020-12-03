////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// cbusLibrary
// Includes encode & decoding functions
//
//		expects the 'raw' CBUS message in the 'Grid connect' CAN over serial message syntax
//
//     : <S | X> <IDENTIFIER> <N> <DATA-0> <DATA-1> … <DATA-7> ;
//
//          Each byte occupies two character positions, starting at position 0
//          For CBUS, an 11 bit CAN identifier is used, and occupies character positions 2 to 5
//          The actual CBUS data starts at character position 7
//          The CBUS opCode is always character positions 7 & 8
//          Any further CBUS data (dependant on opCode) starts at character position 9
//
//      All formats & naming conventions taken from CBUS specification
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
'use strict';


function decToHex(num, len) {return parseInt(num).toString(16).toUpperCase().padStart(len, '0');}

function stringToHex(string) {
  // expects UTF-8 string
  var bytes = new TextEncoder().encode(string);
  return Array.from(
    bytes,
    byte => byte.toString(16).padStart(2, "0")
  ).join("");
}

function hexToString(hex) {
    // returns UTF-8 string
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i !== bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return new TextDecoder().decode(bytes);
}



class cbusLibrary {
    constructor() {
        this.canHeader = {
                    'MjPri': 2,     // lowest allowed priority (highest value)
                    'CAN_ID': 60,
        }
    }

    //
    // header() provides the prefix to add to CBUS data to compose a transmittable message
    // CAN uses a bitwise arbitration scheme whereby the header with the lowest value has priority
    // So higher values have lower priority
    // The CAN protocol prohibits a sequence of 7 or more 1 bits at the start of the header, so a
    // MjPri. of 11 in binary (3 in decimal) is not used
    //
    header = function({
                    MjPri = this.canHeader.MjPri,
                    MinPri = 3,
                    CAN_ID = this.canHeader.CAN_ID
        } = {}) {
        // ensure all variables don't exceed the appropriate number of bits for encoding
        if (MjPri > 2) {MjPri = 2}      // MjPri is two bits, but a value of 3 is not allowed
        MinPri = MinPri % 4             // MinPri is two bits, 0 to 3
        CAN_ID = CAN_ID % 128           // CAN_ID is 7 bits, 0 to 127
		var identifier = parseInt(MjPri << 14) + parseInt(MinPri << 12) + parseInt(CAN_ID << 5) 
        return ':S' + decToHex(identifier, 4) + 'N'
    }

    getCanHeader() {
        return this.canHeader
        }
    setCanHeader(MjPri, CAN_ID) {
        if (MjPri != undefined) { 
        this.canHeader.MjPri = (MjPri > 2) ? 2 : MjPri}                     // MjPri is two bits, but a value of 3 is n0t allowed
        if (CAN_ID != undefined) { this.canHeader.CAN_ID = CAN_ID % 128}    // CAN_ID is 7 bits, 0 to 127
    }
    


    //
    //
    // Decode / Encode Functions strictly arranged by numerical opcode to ensure that it's easy to spot if a function already exists
    //
    //


    //
    // As a full message contains the opCode, a single function can be used to decode any message
    // and it then works out which decoding routine to call dependant on the opCode
    //
    decode = function(message) {
        if (message == undefined) message = this.message;
        var opCode = message.substr(7, 2);
        switch (opCode) {
        case '00':
            return this.decodeACK(message);
            break;
        case '01':
            return this.decodeNAK(message);
            break;
        case '02':
            return this.decodeHLT(message);
            break;
        case '03':
            return this.decodeBON(message);
            break;
        case '04':
            return this.decodeTOF(message);
            break;
        case '05':
            return this.decodeTON(message);
            break;
        case '06':
            return this.decodeESTOP(message);
            break;
        case '07':
            return this.decodeARST(message);
            break;
        case '08':
            return this.decodeRTOF(message);
            break;
        case '09':
            return this.decodeRTON(message);
            break;
        case '0A':
            return this.decodeRESTP(message);
            break;
        // 0B reserved
        case '0C':
            return this.decodeRSTAT(message);
            break;
        case '0D':
            return this.decodeQNN(message);
            break;
        // 0E, 0F reserved
        case '10':
            return this.decodeRQNP(message);
            break;
        case '11':
            return this.decodeRQMN(message);
            break;
        // 12 - 20 reserved
        case '21':
            return this.decodeKLOC(message);
            break;
        case '22':
            return this.decodeQLOC(message);
            break;
        case '23':
            return this.decodeDKEEP(message);
            break;
        // 24 - 2F reserved
        case '30':
            return this.decodeDBG1(message);
            break;
        // 31 - 3E reserved
        case '3F':
            return this.decodeEXTC(message);
            break;
        case '40':
            return this.decodeRLOC(message);
            break;
        case '41':
            return this.decodeQCON(message);
            break;
        case '42':
            return this.decodeSNN(message);
            break;
        case '43':
            return this.decodeALOC(message);
            break;
        case '44':
            return this.decodeSTMOD(message);
            break;
        case '45':
            return this.decodePCON(message);
            break;
        case '46':
            return this.decodeKCON(message);
            break;
        case '47':
            return this.decodeDSPD(message);
            break;
        case '48':
            return this.decodeDFLG(message);
            break;
        case '49':
            return this.decodeDFNON(message);
            break;
        case '4A':
            return this.decodeDFNOF(message);
            break;
        // 4B reserved
        case '4C':
            return this.decodeSSTAT(message);
            break;
        // 4D - 4F reserved
		case '50':
            return this.decodeRQNN(message);
            break;
		case '51':
            return this.decodeNNREL(message);
            break;
        case '52':
            return this.decodeNNACK(message);
            break;
        case '53':
            return this.decodeNNLRN(message);
            break;
        case '54':
            return this.decodeNNULN(message);
            break;
        case '55':
            return this.decodeNNCLR(message);
            break;
        case '56':
            return this.decodeNNEVN(message);
            break;
        case '57':
            return this.decodeNERD(message);
            break;
        case '58':
            return this.decodeRQEVN(message);
            break;
        case '59':
            return this.decodeWRACK(message);
            break;
        case '5A':
            return this.decodeRQDAT(message);
            break;
        case '5B':
            return this.decodeRQDDS(message);
            break;
        case '5C':
            return this.decodeBOOTM(message);
            break;
        case '5D':
            return this.decodeENUM(message);
            break;
        // 5E reserved
        case '5F':
            return this.decodeEXTC1(message);
            break;
        case '60':
            return this.decodeDFUN(message);
            break;
        case '61':
            return this.decodeGLOC(message);
            break;
        // 62 - reserved
        case '63':
            return this.decodeERR(message);
            break;
        // 64 - 6E reserved
        case '6F':
            return this.decodeCMDERR(message);
            break;
        case '70':
            return this.decodeEVNLF(message);
            break;
        case '71':
            return this.decodeNVRD(message);
            break;
        case '72':
            return this.decodeNENRD(message);
            break;
        case '73':
            return this.decodeRQNPN(message);
            break;
        case '74':
            return this.decodeNUMEV(message);
            break;
        case '75':
            return this.decodeCANID(message);
            break;
        // 76 - 7E reserved
        case '7F':
            return this.decodeEXTC2(message);
            break;
        case '80':
            return this.decodeRDCC3(message);
            break;
        // 81 - reserved
        case '82':
            return this.decodeWCVO(message);
            break;
        case '83':
            return this.decodeWCVB(message);
            break;
        case '84':
            return this.decodeQCVS(message);
            break;
        case '85':
            return this.decodePCVS(message);
            break;
        // 86 - 8F reserved
        case '90':
            return this.decodeACON(message);
            break;
        case '91':
            return this.decodeACOF(message);
            break;
        case '92':
            return this.decodeAREQ(message);
            break;
        case '93':
            return this.decodeARON(message);
            break;
        case '94':
            return this.decodeAROF(message);
            break;
        case '95':
            return this.decodeEVULN(message);
            break;
        case '96':
            return this.decodeNVSET(message);
            break;
        case '97':
            return this.decodeNVANS(message);
            break;
        case '98':
            return this.decodeASON(message);
            break;
        case '99':
            return this.decodeASOF(message);
            break;
        case '9A':
            return this.decodeASRQ(message);
            break;
        case '9B':
            return this.decodePARAN(message);
            break;
        case '9C':
            return this.decodeREVAL(message);
            break;
        case '9D':
            return this.decodeARSON(message);
            break;
        case '9E':
            return this.decodeARSOF(message);
            break;
        case '9F':
            return this.decodeEXTC3(message);
            break;
        case 'A0':
            return this.decodeRDCC4(message);
            break;
        // A1 - reserved
        case 'A2':
            return this.decodeWCVS(message);
            break;
        // A3 - AF reserved
        case 'B0':
            return this.decodeACON1(message);
            break;
        case 'B1':
            return this.decodeACOF1(message);
            break;
        case 'B2':
            return this.decodeREQEV(message);
            break;
        case 'B3':
            return this.decodeARON1(message);
            break;
        case 'B4':
            return this.decodeAROF1(message);
            break;
        case 'B5':
            return this.decodeNEVAL(message);
            break;
        case 'B6':
            return this.decodePNN(message);
            break;
        // B7 - reserved
        case 'B8':
            return this.decodeASON1(message);
            break;
        case 'B9':
            return this.decodeASOF1(message);
            break;
        // BA - BC reserved
        case 'BD':
            return this.decodeARSON1(message);
            break;
        case 'BE':
            return this.decodeARSOF1(message);
            break;
        case 'BF':
            return this.decodeEXTC4(message);
            break;
        case 'C0':
            return this.decodeRDCC5(message);
            break;
        case 'C1':
            return this.decodeWCVOA(message);
            break;
        // C2 - CE reserved
        case 'CF':
            return this.decodeFCLK(message);
            break;
        case 'D0':
            return this.decodeACON2(message);
            break;
        case 'D1':
            return this.decodeACOF2(message);
            break;
        case 'D2':
            return this.decodeEVLRN(message);
            break;
        case 'D3':
            return this.decodeEVANS(message);
            break;
        case 'D4':
            return this.decodeARON2(message);
            break;
        case 'D5':
            return this.decodeAROF2(message);
            break;
        // D6 - D7 reserved
        case 'D8':
            return this.decodeASON2(message);
            break;
        case 'D9':
            return this.decodeASOF2(message);
            break;
        // DA - DC reserved
        case 'DD':
            return this.decodeARSON2(message);
            break;
        case 'DE':
            return this.decodeARSOF2(message);
            break;
        case 'DF':
            return this.decodeEXTC5(message);
            break;
        case 'E0':
            return this.decodeRDCC6(message);
            break;
        case 'E1':
            return this.decodePLOC(message);
            break;
        case 'E2':
            return this.decodeNAME(message);
            break;
        case 'E3':
            return this.decodeSTAT(message);
            break;
        // E4 - EE reserved
        case 'F0':
            return this.decodeACON3(message);
            break;
        case 'EF':
            return this.decodePARAMS(message);
            break;
        case 'F0':
            return this.decodeACON3(message);
            break;
        case 'F1':
            return this.decodeACOF3(message);
            break;
        case 'F2':
            return this.decodeENRSP(message);
            break;
        case 'F3':
            return this.decodeARON3(message);
            break;
        case 'F4':
            return this.decodeAROF3(message);
            break;
        case 'F5':
            return this.decodeEVLRNI(message);
            break;
        case 'F6':
            return this.decodeACDAT(message);
            break;
        case 'F7':
            return this.decodeARDAT(message);
            break;
        case 'F8':
            return this.decodeASON3(message);
            break;
        case 'F9':
            return this.decodeASOF3(message);
            break;
        case 'FA':
            return this.decodeDDES(message);
            break;
        case 'FB':
            return this.decodeDDRS(message);
            break;
        // FC - reserved
        case 'FD':
            return this.decodeARSON3(message);
            break;
        case 'FE':
            return this.decodeARSOF3(message);
            break;
        case 'FF':
            return this.decodeEXTC6(message);
            break;

        default:
            return {'encoded': message ,'mnemonic': 'UNSUPPORTED', 'opCode': message.substr(7, 2)}
            break;
        }
    }



    // 00 ACK
    // ACK Format: [<MjPri><MinPri=2><CANID>]<00>
    decodeACK = function(message) {
        return {'encoded': message,
                'mnemonic': 'ACK',
                'opCode': message.substr(7, 2),
                'text': 'ACK (00)',
        }
    }
    encodeACK = function() {
        return this.header({MinPri: 2}) + '00' + ';'
    }


    // 01 NAK
    // NAK Format: [<MjPri><MinPri=2><CANID>]<01>
    //
    decodeNAK = function(message) {
        return {'encoded': message,
                'mnemonic': 'NAK',
                'opCode': message.substr(7, 2),
                'text': 'NAK (01)',
        }
    }
    encodeNAK = function() {
        return this.header({MinPri: 2}) + '01' + ';'
    }


    // 02 HLT
    // HLT Format: [<MjPri><MinPri=0><CANID>]<02>
    //
    decodeHLT = function(message) {
        return {'encoded': message,
                'mnemonic': 'HLT',
                'opCode': message.substr(7, 2),
                'text': 'HLT (02)',
        }
    }
    encodeHLT = function() {
        return this.header({MinPri: 0}) + '02' + ';'
    }


    // 03 BON
    // BON Format: [<MjPri><MinPri=1><CANID>]<03>
    //
    decodeBON = function(message) {
        return {'encoded': message,
                'mnemonic': 'BON',
                'opCode': message.substr(7, 2),
                'text': 'BON (03)',
        }
    }
    encodeBON = function() {
        return this.header({MinPri: 1}) + '03' + ';'
    }


    // 04 TOF
    // TOF Format: [<MjPri><MinPri=1><CANID>]<04>
    //
    decodeTOF = function(message) {
        return {'encoded': message,
                'mnemonic': 'TOF',
                'opCode': message.substr(7, 2),
                'text': 'TOF (04)',
        }
    }
    encodeTOF = function() {
        return this.header({MinPri: 1}) + '04' + ';'
    }


    // 05 TON
    // TON Format: [<MjPri><MinPri=1><CANID>]<05>
    //
    decodeTON = function(message) {
        return {'encoded': message,
                'mnemonic': 'TON',
                'opCode': message.substr(7, 2),
                'text': 'TON (05)',
        }
    }
    encodeTON = function() {
        return this.header({MinPri: 1}) + '05' + ';'
    }


    // 06 ESTOP
    // ESTOP Format: [<MjPri><MinPri=1><CANID>]<06>
    //
    decodeESTOP = function(message) {
        return {'encoded': message,
                'mnemonic': 'ESTOP',
                'opCode': message.substr(7, 2),
                'text': 'ESTOP (06)',
        }
    }
    encodeESTOP = function() {
        return this.header({MinPri: 1}) + '06' + ';'
    }


    // 07 ARST
    // ARST Format: [<MjPri><MinPri=0><CANID>]<07>
    //
    decodeARST = function(message) {
        return {'encoded': message,
                'mnemonic': 'ARST',
                'opCode': message.substr(7, 2),
                'text': 'ARST (07)',
        }
    }
    encodeARST = function() {
        return this.header({MinPri: 0}) + '07' + ';'
    }


    // 08 RTOF
    // RTOF Format: [<MjPri><MinPri=1><CANID>]<08>
    //
    decodeRTOF = function(message) {
        return {'encoded': message,
                'mnemonic': 'RTOF',
                'opCode': message.substr(7, 2),
                'text': 'RTOF (08)',
        }
    }
    encodeRTOF = function() {
        return this.header({MinPri: 1}) + '08' + ';'
    }


    // 09 RTON
    // RTON Format: [<MjPri><MinPri=1><CANID>]<09>
    //
    decodeRTON = function(message) {
        return {'encoded': message,
                'mnemonic': 'RTON',
                'opCode': message.substr(7, 2),
                'text': 'RTON (09)',
        }
    }
    encodeRTON = function() {
        return this.header({MinPri: 1}) + '09' + ';'
    }


    // 0A RESTP
    // RESTP Format: [<MjPri><MinPri=0><CANID>]<0A>
    //
    decodeRESTP = function(message) {
        return {'encoded': message,
                'mnemonic': 'RESTP',
                'opCode': message.substr(7, 2),
                'text': 'RESTP (0A)',
        }
    }
    encodeRESTP = function() {
        return this.header({MinPri: 0}) + '0A' + ';'
    }


    // 0C RSTAT
    // RSTAT Format: [<MjPri><MinPri=2><CANID>]<0C>
    //
    decodeRSTAT = function(message) {
        return {'encoded': message,
                'mnemonic': 'RSTAT',
                'opCode': message.substr(7, 2),
                'text': 'RSTAT (0C)',
        }
    }
    encodeRSTAT = function() {
        return this.header({MinPri: 2}) + '0C' + ';'
    }


    // 0D QNN
    // QNN Format: [<MjPri><MinPri=3><CANID>]<0D>
    //
    decodeQNN = function(message) {
        return {'encoded': message,
                'mnemonic': 'QNN',
                'opCode': message.substr(7, 2),
                'text': 'QNN (0D)',
        }
    }
    encodeQNN = function() {//Request Node Parameters
        return this.header({MinPri: 3}) + '0D' + ';'
    }


    // 10 RQNP
    // RQNP Format: [<MjPri><MinPri=3><CANID>]<10>
    //
    decodeRQNP = function(message) {
        return {'encoded': message,
                'mnemonic': 'RQNP',
                'opCode': message.substr(7, 2),
                'text': 'RQNP (10)',
        }
    }
    encodeRQNP = function() {
        return this.header({MinPri: 3}) + '10' + ';'
    }


    // 11 RQMN
	// RQMN Format: [<MjPri><MinPri=2><CANID>]<11>
    //
    decodeRQMN = function(message) {
        return {'encoded': message,
                'mnemonic': 'RQMN',
                'opCode': message.substr(7, 2),
                'text': 'RQMN (11)',
        }
    }
    encodeRQMN = function() {//Request Node Parameters
        return this.header({MinPri: 2}) + '11' + ';'
    }


    // 21 KLOC
    // KLOC Format: [<MjPri><MinPri=2><CANID>]<21><Session>
    //
    decodeKLOC = function(message) {
        return {'encoded': message,
                'mnemonic': 'KLOC',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'text': 'KLOC (21) Session ' + parseInt(message.substr(9, 2), 16),
        }
    }
    encodeKLOC = function(session) {
        return this.header({MinPri: 2}) + '21' + decToHex(session, 2) + ';';
    }
    

    // 22 QLOC
	// QLOC Format: [<MjPri><MinPri=2><CANID>]<22><Session>
    //
    decodeQLOC = function(message) {
        return {'encoded': message,
                'mnemonic': 'QLOC',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'text': 'QLOC (22) session ' + parseInt(message.substr(9, 2), 16),
        }
    }
    encodeQLOC = function(session) {
        return this.header({MinPri: 2}) + '22' + decToHex(session, 2) + ';';
    }


    // 23 DKEEP
    // DKEEP Format: [<MjPri><MinPri=2><CANID>]<23><Session>
    //
    decodeDKEEP = function(message) {
        return {'encoded': message,
                'mnemonic': 'DKEEP',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'text': 'DKEEP (23) session ' + parseInt(message.substr(9, 2), 16),
        }
    }
    encodeDKEEP = function(session) {
        return this.header({MinPri: 2}) + '23' + decToHex(session, 2) + ';';
    }
    

    // 30 DBG1
    // DBG1 Format: [<MjPri><MinPri=2><CANID>]<30><Status>
    //
    decodeDBG1 = function(message) {
        return {'encoded': message,
                'mnemonic': 'DBG1',
                'opCode': message.substr(7, 2),
                'status': parseInt(message.substr(9, 2), 16),
                'text': 'DBG1 (30) status ' + parseInt(message.substr(9, 2), 16),
        }
    }
    encodeDBG1 = function(status) {
        return this.header({MinPri: 2}) + '30' + decToHex(status, 2) + ';';
    }
    

    // 3F EXTC
    // EXTC Format: [<MjPri><MinPri=3><CANID>]<3F><Ext_OPC>
    //
    decodeEXTC = function(message) {
        return {'encoded': message,
                'mnemonic': 'EXTC',
                'opCode': message.substr(7, 2),
                'Ext_OPC': parseInt(message.substr(9, 2), 16),
                'text': 'EXTC (3F) Ext_OPC ' + parseInt(message.substr(9, 2), 16),
        }
    }
    encodeEXTC = function(Ext_OPC) {
        return this.header({MinPri: 3}) + '3F' + decToHex(Ext_OPC, 2) + ';';
    }
    

    // 40 RLOC
	// RLOC Format: [<MjPri><MinPri=2><CANID>]<40><Dat1><Dat2 >
    // <Dat1> and <Dat2> are [AddrH] and [AddrL] of the decoder, respectively.
    //
    decodeRLOC = function(message) {
        return {'encoded': message,
                'mnemonic': 'RLOC',
                'opCode': message.substr(7, 2),
                'address': parseInt(message.substr(9, 4), 16),
                'text': 'RLOC (40) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeRLOC = function(address) {
        return this.header({MinPri: 2}) + '40' + decToHex(address, 4) + ';'
    }


    // 41 QCON
	// RLOC Format: <MjPri><MinPri=2><CANID>]<41><ConID><Index>
    //
    decodeQCON = function(message) {
        return {'encoded': message,
                'mnemonic': 'QCON',
                'opCode': message.substr(7, 2),
                'conID': parseInt(message.substr(9, 2), 16),
                'index': parseInt(message.substr(11, 2), 16),
                'text': 'QCON (41) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeQCON = function(conID, index) {
        return this.header({MinPri: 2}) + '41' + decToHex(conID, 2) + decToHex(index, 2) + ';'
    }


    // 42 SNN
	// SNN Format: [<MjPri><MinPri=3><CANID>]<42><NNHigh><NNLow>
    //
    decodeSNN = function(message) {
        return {'encoded': message,
                'mnemonic': 'SNN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': 'SNN (42) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeSNN = function(nodeNumber) {
            return this.header({MinPri: 3}) + '42' + decToHex(nodeNumber, 4) + ';'
    }


    // 43 ALOC
	// ALOC Format: [<MjPri><MinPri=2><CANID>]<43><Session ID><Allocation code >
    //
    decodeALOC = function(message) {
        return {'encoded': message,
                'mnemonic': 'ALOC',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'allocationCode': parseInt(message.substr(11, 2), 16),
                'text': 'ALOC (43) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeALOC = function(session, allocatonCode) {
            return this.header({MinPri: 2}) + '43' + decToHex(session, 2) + decToHex(allocatonCode, 2) + ';'
    }


    // 44 STMOD
	// STMOD Format: [<MjPri><MinPri=2><CANID>]<44><Session><MMMMMMMM>
    //
    decodeSTMOD = function(message) {
        return {'encoded': message,
                'mnemonic': 'STMOD',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'modeByte': parseInt(message.substr(11, 2), 16),
                'text': 'STMOD (44) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeSTMOD = function(session, modeByte) {
            return this.header({MinPri: 2}) + '44' + decToHex(session, 2) + decToHex(modeByte, 2) + ';'
    }


    // 45 PCON
	// PCON Format: [<MjPri><MinPri=2><CANID>]<45><Session><Consist#>
    //
    decodePCON = function(message) {
        return {'encoded': message,
                'mnemonic': 'PCON',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'consistAddress': parseInt(message.substr(11, 2), 16),
                'text': 'PCON (45) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    encodePCON = function(session, consistAddress) {
            return this.header({MinPri: 2}) + '45' + decToHex(session, 2) + decToHex(consistAddress, 2) + ';'
    }


    // 46 KCON
	// KCON Format: Format: [<MjPri><MinPri=2><CANID>]<46><Session><Consist#>
    //
    decodeKCON = function(message) {
        return {'encoded': message,
                'mnemonic': 'KCON',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'consistAddress': parseInt(message.substr(11, 2), 16),
                'text': 'KCON (46) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeKCON = function(session, consistAddress) {
            return this.header({MinPri: 2}) + '46' + decToHex(session, 2) + decToHex(consistAddress, 2) + ';'
    }


    // 47 DSPD
    // DSPD Format: [<MjPri><MinPri=2><CANID>]<47><Session><Speed/Dir>
    //
    decodeDSPD = function(message) {
        var speedDir = parseInt(message.substr(11, 2), 16)
        var direction = (speedDir > 127) ? 'Forward' : 'Reverse'
        return {'encoded': message,
                'mnemonic': 'DSPD',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'speed': speedDir % 128,
                'direction': direction,
                'text': 'DSPD (47) Session ' + parseInt(message.substr(9, 2), 16) + 
                    ' Speed ' + speedDir % 128 + 
                    ' Direction ' + direction,
        }
    }
    encodeDSPD = function(session, speed, direction) {
        var speedDir = speed + parseInt((direction == 'Reverse') ? 0 : 128)
        return this.header({MinPri: 2}) + '47' + decToHex(session, 2) + decToHex(speedDir, 2) + ';';
    }
    

    // 48 DFLG
	// DFLG Format: Format: <MjPri><MinPri=2><CANID>]<48><Session><DDDDDDDD>
    //
    decodeDFLG = function(message) {
        return {'encoded': message,
                'mnemonic': 'DFLG',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'flags': parseInt(message.substr(11, 2), 16),
                'text': 'DFLG (48) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeDFLG = function(session, flags) {
            return this.header({MinPri: 2}) + '48' + decToHex(session, 2) + decToHex(flags, 2) + ';'
    }


    // 49 DFNON
	// DFNON Format: Format: <MjPri><MinPri=2><CANID>]<49><Session><Fnum>
    //
    decodeDFNON = function(message) {
        return {'encoded': message,
                'mnemonic': 'DFNON',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'functionNumber': parseInt(message.substr(11, 2), 16),
                'text': 'DFNON (49) session ' + parseInt(message.substr(9, 2), 16) +
                    ' function ' + parseInt(message.substr(11, 2), 16),
        }
    }
    encodeDFNON = function(session, functionNumber) {
            return this.header({MinPri: 2}) + '49' + decToHex(session, 2) + decToHex(functionNumber, 2) + ';'
    }


    // 4A DFNOF
	// DFNOF Format: Format: <MjPri><MinPri=2><CANID>]<4A><Session><Fnum>
    //
    decodeDFNOF = function(message) {
        return {'encoded': message,
                'mnemonic': 'DFNOF',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'functionNumber': parseInt(message.substr(11, 2), 16),
                'text': 'DFNOF (4A) session ' + parseInt(message.substr(9, 2), 16) +
                    ' function ' + parseInt(message.substr(11, 2), 16),
        }
    }
    encodeDFNOF = function(session, functionNumber) {
            return this.header({MinPri: 2}) + '4A' + decToHex(session, 2) + decToHex(functionNumber, 2) + ';'
    }


    // 4C SSTAT
	// SSTAT Format: Format: [<MjPri><MinPri=3><CANID>]<4C><Session><Status>
    //
    decodeSSTAT = function(message) {
        return {'encoded': message,
                'mnemonic': 'SSTAT',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'status': parseInt(message.substr(11, 2), 16),
                'text': 'SSTAT (4C) session ' + parseInt(message.substr(9, 2), 16) +
                    ' status ' + parseInt(message.substr(11, 2), 16),
        }
    }
    encodeSSTAT = function(session, status) {
            return this.header({MinPri: 3}) + '4C' + decToHex(session, 2) + decToHex(status, 2) + ';'
    }


    // 50 RQNN
	// RQNN Format: [<MjPri><MinPri=3><CANID>]<50><NN hi><NN lo>
    //
    decodeRQNN = function(message) {
        return {'encoded': message,
                'mnemonic': 'RQNN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': 'RQNN (50) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeRQNN = function(nodeNumber) {
        return this.header({MinPri: 3}) + '50' + decToHex(nodeNumber, 4) + ';'
    }
    

    // 51 NNREL
	// NNREL Format: [<MjPri><MinPri=3><CANID>]<51><NN hi><NN lo>
    //
    decodeNNREL = function(message) {
        return {'encoded': message,
                'mnemonic': 'NNREL',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': 'NNREL (51) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeNNREL = function(nodeNumber) {
        return this.header({MinPri: 3}) + '51' + decToHex(nodeNumber, 4) + ';'
    }
    

    // 52 NNACK
	// NNACK Format: [<MjPri><MinPri=3><CANID>]<52><NN hi><NN lo>
    //
    decodeNNACK = function(message) {
        return {'encoded': message,
                'mnemonic': 'NNACK',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': 'NNACK (52) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeNNACK = function(nodeNumber) {
		if (nodeNumber >= 0 && nodeNumber <= 0xFFFF) {
			return this.header({MinPri: 3}) + '52' + decToHex(nodeNumber, 4) + ';'
		}
    }


    // 53 NNLRN
	// NNLRN Format: [<MjPri><MinPri=3><CANID>]<53><NN hi><NN lo>
    //
    decodeNNLRN = function(message) {
        return {'encoded': message,
                'mnemonic': 'NNLRN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': 'NNLRN (53) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeNNLRN = function(nodeNumber) {
		if (nodeNumber >= 0 && nodeNumber <= 0xFFFF) {
			return this.header({MinPri: 3}) + '53' + decToHex(nodeNumber, 4) + ';'
		}
    }


    // 54 NNULN
	// NNULN Format: [<MjPri><MinPri=3><CANID>]<54><NN hi><NN lo>>
    //
    decodeNNULN = function(message) {
        return {'encoded': message,
                'mnemonic': 'NNULN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': 'NNULN (54) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeNNULN = function(nodeNumber) {
        return this.header({MinPri: 3}) + '54' + decToHex(nodeNumber, 4) + ';'
    }


    // 55 NNCLR
	// NNCLR Format: [<MjPri><MinPri=3><CANID>]<55><NN hi><NN lo>>
    //
    decodeNNCLR = function(message) {
        return {'encoded': message,
                'mnemonic': 'NNCLR',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': 'NNCLR (55) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeNNCLR = function(nodeNumber) {
        return this.header({MinPri: 3}) + '55' + decToHex(nodeNumber, 4) + ';'
    }


    // 56 NNEVN
	// NNEVN Format: [<MjPri><MinPri=3><CANID>]<56><NN hi><NN lo>>
    //
    decodeNNEVN = function(message) {
        return {'encoded': message,
                'mnemonic': 'NNEVN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': 'NNEVN (56) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeNNEVN = function(nodeNumber) {
        return this.header({MinPri: 3}) + '56' + decToHex(nodeNumber, 4) + ';'
    }


    // 57 NERD
	// NERD Format: [<MjPri><MinPri=3><CANID>]<57><NN hi><NN lo>
    //
    decodeNERD = function(message) {
		// NERD Format: [<MjPri><MinPri=3><CANID>]<57><NN hi><NN lo>
        return {'encoded': message,
                'mnemonic': 'NERD',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': 'NERD (57) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeNERD = function(nodeNumber) {
        return this.header({MinPri: 3}) + '57' + decToHex(nodeNumber, 4) + ';'
    }


    // 58 RQEVN
    // RQEVN Format: [<MjPri><MinPri=3><CANID>]<58><NN hi><NN lo>
    //
    decodeRQEVN = function(message) {
		// RQEVN Format: [<MjPri><MinPri=3><CANID>]<58><NN hi><NN lo>
        return {'encoded': message,
                'mnemonic': 'RQEVN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': 'RQEVN (58) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeRQEVN = function(nodeNumber) {
        return this.header({MinPri: 3}) + '58' + decToHex(nodeNumber, 4) + ';'
    }


    // 59 WRACK
	// WRACK Format: [<MjPri><MinPri=3><CANID>]<59><NN hi><NN lo>
    //
    decodeWRACK = function(message) {
        return {'encoded': message,
                'mnemonic': 'WRACK',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': "WRACK (59) Node " + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeWRACK = function(nodeNumber) {
        return this.header({MinPri: 3}) + '59' + decToHex(nodeNumber, 4) + ';'
    }


    // 5A RQDAT
	// RQDAT Format: [<MjPri><MinPri=3><CANID>]<5A><NN hi><NN lo>
    //
    decodeRQDAT = function(message) {
        return {'encoded': message,
                'mnemonic': 'RQDAT',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': "RQDAT (5A) Node " + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeRQDAT = function(nodeNumber) {
        return this.header({MinPri: 3}) + '5A' + decToHex(nodeNumber, 4) + ';'
    }


    // 5B RQDDS
	// RQDDS Format: [<MjPri><MinPri=3><CANID>]<5B><NN hi><NN lo>
    //
    decodeRQDDS = function(message) {
        return {'encoded': message,
                'mnemonic': 'RQDDS',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': "RQDDS (5B) Node " + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeRQDDS = function(nodeNumber) {
        return this.header({MinPri: 3}) + '5B' + decToHex(nodeNumber, 4) + ';'
    }


    // 5C BOOTM
	// BOOTM Format: [<MjPri><MinPri=3><CANID>]<5C><NN hi><NN lo>
    //
    decodeBOOTM = function(message) {
        return {'encoded': message,
                'mnemonic': 'BOOTM',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': "BOOTM (5C) Node " + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeBOOTM = function(nodeNumber) {
        return this.header({MinPri: 3}) + '5C' + decToHex(nodeNumber, 4) + ';'
    }


    // 5D ENUM
	// ENUM Format: [<MjPri><MinPri=3><CANID>]<5D><NN hi><NN lo>
    //
    decodeENUM = function(message) {
        return {'encoded': message,
                'mnemonic': 'ENUM',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': "ENUM (5D) Node " + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeENUM = function(nodeNumber) {
        return this.header({MinPri: 3}) + '5D' + decToHex(nodeNumber, 4) + ';'
    }


    // 5F EXTC1
	// EXTC1 Format: [<MjPri><MinPri=3><CANID>]<5F><Ext_OPC><byte1>
    //
    decodeEXTC1 = function(message) {
        return {'encoded': message,
                'mnemonic': 'EXTC1',
                'opCode': message.substr(7, 2),
                'Ext_OPC': parseInt(message.substr(9, 2), 16),
                'byte1': parseInt(message.substr(11, 2), 16),
                'text': "EXTC1 (5F) Node " + parseInt(message.substr(9, 4), 16),
        }
    }
    encodeEXTC1 = function(Ext_OPC, byte1) {
        return this.header({MinPri: 3}) + '5F' + decToHex(Ext_OPC, 2) + decToHex(byte1, 2) + ';'
    }


    // 60 DFUN
    // DFUN Format: [<MjPri><MinPri=2><CANID>]<60><Session><Fn1><Fn2>
    //
    decodeDFUN = function(message) {
        return {'encoded': message,
                'mnemonic': 'DFUN',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'Fn1': parseInt(message.substr(11, 2), 16),
                'Fn2': parseInt(message.substr(13, 2), 16),
                'text': "DFUN (60) Session " + parseInt(message.substr(9, 2), 16) +
					" Fn1 " + parseInt(message.substr(11, 2), 16) +
					" Fn2 " + parseInt(message.substr(13, 2), 16),
        }
    }
    encodeDFUN = function(session, Fn1, Fn2) {
        return this.header({MinPri: 2}) + '60' + decToHex(session, 2) + decToHex(Fn1, 2) + decToHex(Fn2, 2) + ';';
    }


    // 61 GLOC
    // GLOC Format: [<MjPri><MinPri=2><CANID>]<61><Dat1><Dat2><Flags>
    // <Dat1> and <Dat2> are [AddrH] and [AddrL] of the decoder, respectively.
    //
    decodeGLOC = function(message) {
        return {'encoded': message,
                'mnemonic': 'GLOC',
                'opCode': message.substr(7, 2),
                'address': parseInt(message.substr(9, 4), 16),
                'flags': parseInt(message.substr(13, 2), 16),
                'text': "GLOC (61) address " + parseInt(message.substr(9, 4), 16) +
					" flags " + parseInt(message.substr(13, 2), 16),
        }
    }
    encodeGLOC = function(address, flags) {
        return this.header({MinPri: 2}) + '61' + decToHex(address, 4) + decToHex(flags, 2) + ';';
    }


    // 63 ERR
    // ERR Format: [<MjPri><MinPri=2><CANID>]<63><Dat 1><Dat 2><Dat 3>
    // data 3 is currently assigned to error number
    //
    decodeERR = function(message) {
        return {'encoded': message,
                'mnemonic': 'ERR',
                'opCode': message.substr(7, 2),
                'data1': parseInt(message.substr(9, 2), 16),
                'data2': parseInt(message.substr(11, 2), 16),
                'errorNumber': parseInt(message.substr(13, 2), 16),
                'text': "ERR (63) data1 " + parseInt(message.substr(9, 2), 16) +
					" data2 " + parseInt(message.substr(11, 2), 16) +
					" errorNumber " + parseInt(message.substr(13, 2), 16),
        }
    }
    encodeERR = function(data1, data2, errorNumber) {
        return this.header({MinPri: 2}) + '63' + decToHex(data1, 2) + decToHex(data2, 2) + decToHex(errorNumber, 2) + ';';
    }

    
    // 6F CMDERR
    // CMDERR Format: [<MjPri><MinPri=3><CANID>]<6F><NN hi><NN lo><Error number>
    //
    decodeCMDERR = function(message) {
		return {'encoded': message,
                'mnemonic': 'CMDERR',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'errorNumber': parseInt(message.substr(13, 2), 16),
                'text': "CMDERR (6F) Node " + parseInt(message.substr(9, 4), 16) + 
					" errorNumber " + parseInt(message.substr(13, 2), 16)
        }
    }
    encodeCMDERR = function(nodeNumber, errorNumber) {
        return this.header({MinPri: 3}) + '6F' + decToHex(nodeNumber, 4) + decToHex(errorNumber, 2) + ';';
    }


    // 70 EVNLF
    // EVNLF Format: [<MjPri><MinPri=3><CANID>]<70><NN hi><NN lo><EVSPC>
    //
    decodeEVNLF = function(message) {
		return {'encoded': message,
                'mnemonic': 'EVNLF',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'EVSPC': parseInt(message.substr(13, 2), 16),
                'text': "EVNLF (70) Node " + parseInt(message.substr(9, 4), 16) + 
					" EVNLF " + parseInt(message.substr(13, 2), 16)
        }
    }
    encodeEVNLF = function(nodeNumber, EVNLF) {
        return this.header({MinPri: 3}) + '70' + decToHex(nodeNumber, 4) + decToHex(EVNLF, 2) + ';'
    }


    // 71 NVRD
    // NVRD Format: [<MjPri><MinPri=3><CANID>]<71><NN hi><NN lo><NV#>
    //
    decodeNVRD = function(message) {
		return {'encoded': message,
                'mnemonic': 'NVRD',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'nodeVariableIndex': parseInt(message.substr(13, 2), 16),
                'text': "NVRD (71) Node " + parseInt(message.substr(9, 4), 16) + 
					" Node Variable Index " + parseInt(message.substr(13, 2), 16)
        }
    }
    encodeNVRD = function(nodeNumber, nodeVariableIndex) {
        return this.header({MinPri: 3}) + '71' + decToHex(nodeNumber, 4) + decToHex(nodeVariableIndex, 2) + ';'
    }


    // 72 NENRD
	// NENRD Format: [<MjPri><MinPri=3><CANID>]<72><NN hi><NN lo><EN#>
    //
    decodeNENRD = function(message) {
		return {'encoded': message,
                'mnemonic': 'NENRD',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventIndex': parseInt(message.substr(13, 2), 16),
                'text': "NENRD (72) Node " + parseInt(message.substr(9, 4), 16) + 
					" Event Index " + parseInt(message.substr(13, 2), 16)
        }
    }
    encodeNENRD = function(nodeNumber, eventIndex) {
        return this.header({MinPri: 3}) + '72' + decToHex(nodeNumber, 4) + decToHex(eventIndex, 2) + ';'
    }


    // 73 RQNPN
    // RQNPN Format: [<MjPri><MinPri=3><CANID>]<73><NN hi><NN lo><Para#>
    //
    decodeRQNPN = function(message) {
		return {'encoded': message,
                'mnemonic': 'RQNPN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'parameterIndex': parseInt(message.substr(13, 2), 16),
                'text': "RQNPN (73) Node " + parseInt(message.substr(9, 4), 16) + 
					" Node parameter Index " + parseInt(message.substr(13, 2), 16)
        }
    }
    encodeRQNPN = function(nodeNumber, parameterIndex) {
        return this.header({MinPri: 3}) + '73' + decToHex(nodeNumber, 4) + decToHex(parameterIndex, 2) + ';'
    }


    // 74 NUMEV
    // NUMEV Format: [<MjPri><MinPri=3><CANID>]<74><NN hi><NN lo><No.of events>
    //
    decodeNUMEV = function(message) {
        return {'encoded': message,
                'mnemonic': 'NUMEV',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'eventCount': parseInt(message.substr(13, 2), 16),
                'text': "NUMEV (74) Node " + parseInt(message.substr(9, 4), 16) + 
					" Event Count " + parseInt(message.substr(13, 2), 16)
        }
    }
    encodeNUMEV = function(nodeNumber, eventCount) {
        return this.header({MinPri: 3}) + '74' + decToHex(nodeNumber, 4) + decToHex(eventCount, 2) + ';'
    }
    

    // 75 CANID
    // CANID Format: [<MjPri><MinPri=3><CANID>]<75><NN hi><NN lo><CAN_ID >
    //
    decodeCANID = function(message) {
        return {'encoded': message,
                'mnemonic': 'CANID',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'CAN_ID': parseInt(message.substr(13, 2), 16),
                'text': "CANID (75) Node " + parseInt(message.substr(9, 4), 16) + 
					" CAN_ID " + parseInt(message.substr(13, 2), 16)
        }
    }
    encodeCANID = function(nodeNumber, CAN_ID) {
        return this.header({MinPri: 3}) + '75' + decToHex(nodeNumber, 4) + decToHex(CAN_ID, 2) + ';'
    }
    

    // 7F EXTC2
    // EXTC2 Format: [<MjPri><MinPri=3><CANID>]<7F><Ext_OPC><byte1><byte2>
    //
    decodeEXTC2 = function(message) {
        return {'encoded': message,
                'mnemonic': 'EXTC2',
                'opCode': message.substr(7, 2),
                'Ext_OPC': parseInt(message.substr(9, 2), 16),
                'byte1': parseInt(message.substr(11, 2), 16),
                'byte2': parseInt(message.substr(13, 2), 16),
                'text': "EXTC2 (7F) Ext_OPC " + parseInt(message.substr(9, 2), 16) + 
					" byte1 " + parseInt(message.substr(11, 2), 16) +
					" byte2 " + parseInt(message.substr(13, 2), 16)
        }
    }
    encodeEXTC2 = function(Ext_OPC, byte1, byte2) {
        return this.header({MinPri: 3}) + '7F' + decToHex(Ext_OPC, 2) + decToHex(byte1, 2) + decToHex(byte2, 2) + ';'
    }
    

    // 80 RDCC3
    // RDCC3 Format: <MjPri><MinPri=2><CANID>]<80><REP><Byte0>..<Byte2>
    //
    decodeRDCC3 = function(message) {
        return {'encoded': message,
                'mnemonic': 'RDCC3',
                'opCode': message.substr(7, 2),
                'repetitions': parseInt(message.substr(9, 2), 16),
                'byte0': parseInt(message.substr(11, 2), 16),
                'byte1': parseInt(message.substr(13, 2), 16),
                'byte2': parseInt(message.substr(15, 2), 16),
                'text': "RDCC3 (80) repetitions " + parseInt(message.substr(9, 2), 16) + 
					" byte0 " + parseInt(message.substr(11, 2), 16) +
					" byte1 " + parseInt(message.substr(13, 2), 16) +
					" byte2 " + parseInt(message.substr(15, 2), 16)
        }
    }
    encodeRDCC3 = function(repetitions, byte0, byte1, byte2) {
        return this.header({MinPri: 2}) + '80' + decToHex(repetitions, 2) + decToHex(byte0, 2) + decToHex(byte1, 2) + decToHex(byte2, 2) + ';'
    }
    

    // 82 WCVO
    // WCVO Format: <MjPri><MinPri=2><CANID>]<82><Session><High CV#><Low CV#><Val>
    //
    decodeWCVO = function(message) {
        return {'encoded': message,
                'mnemonic': 'WCVO',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'CV': parseInt(message.substr(11, 4), 16),
                'value': parseInt(message.substr(15, 2), 16),
                'text': "WCVO (82) session " + parseInt(message.substr(9, 2), 16) + 
					" CV " + parseInt(message.substr(11, 4), 16) +
					" value " + parseInt(message.substr(15, 2), 16)
        }
    }
    encodeWCVO = function(session, CV, value) {
        return this.header({MinPri: 2}) + '82' + decToHex(session, 2) + decToHex(CV, 4) + decToHex(value, 2) + ';'
    }
    

    // 83 WCVB
    // WCVB Format: <MjPri><MinPri=2><CANID>]<83><Session><High CV#><Low CV#><Val>
    //
    decodeWCVB = function(message) {
        return {'encoded': message,
                'mnemonic': 'WCVB',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'CV': parseInt(message.substr(11, 4), 16),
                'value': parseInt(message.substr(15, 2), 16),
                'text': "WCVB (83) session " + parseInt(message.substr(9, 2), 16) + 
					" CV " + parseInt(message.substr(11, 2), 16) +
					" value " + parseInt(message.substr(15, 2), 16)
        }
    }
    encodeWCVB = function(session, CV, value) {
        return this.header({MinPri: 2}) + '83' + decToHex(session, 2) + decToHex(CV, 4) + decToHex(value, 2) + ';'
    }
    

    // 84 QCVS
    // QCVS Format: [<MjPri><MinPri=2><CANID>]<84><Session><High CV#><Low CV#><Mode>
    //
    decodeQCVS = function(message) {
        return {'encoded': message,
                'mnemonic': 'QCVS',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'CV': parseInt(message.substr(11, 4), 16),
                'Mode': parseInt(message.substr(15, 2), 16),
                'text': "QCVS (84) session " + parseInt(message.substr(9, 2), 16) + 
					" CV " + parseInt(message.substr(11, 2), 16) +
					" Mode " + parseInt(message.substr(15, 2), 16)
        }
    }
    encodeQCVS = function(session, CV, Mode) {
        return this.header({MinPri: 2}) + '84' + decToHex(session, 2) + decToHex(CV, 4) + decToHex(Mode, 2) + ';'
    }
    

    // 85 PCVS
    // PCVS Format: [<MjPri><MinPri=2><CANID>]<85><Session><High CV#><Low CV#><Val>
    //
    decodePCVS = function(message) {
        return {'encoded': message,
                'mnemonic': 'PCVS',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'CV': parseInt(message.substr(11, 4), 16),
                'value': parseInt(message.substr(15, 2), 16),
                'text': "PCVS (85) session " + parseInt(message.substr(9, 2), 16) + 
					" CV " + parseInt(message.substr(11, 2), 16) +
					" value " + parseInt(message.substr(15, 2), 16)
        }
    }
    encodePCVS = function(session, CV, value) {
        return this.header({MinPri: 2}) + '85' + decToHex(session, 2) + decToHex(CV, 4) + decToHex(value, 2) + ';'
    }
    

    // 90 ACON
	// ACON Format: [<MjPri><MinPri=3><CANID>]<90><NN hi><NN lo><EN hi><EN lo>
    //
    decodeACON = function(message) {
		return {'encoded': message,
                'mnemonic': 'ACON',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {hex:''},
                'text': "ACON (90) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16)
        }
    }
    encodeACON = function(nodeNumber, eventNumber) {
        return this.header({MinPri: 3}) + '90' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) + ';';
    }


    // 91 ACOF
	// ACOF Format: [<MjPri><MinPri=3><CANID>]<91><NN hi><NN lo><EN hi><EN lo>
    //
    decodeACOF = function(message) {
		return {'encoded': message,
                'mnemonic': 'ACOF',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {hex:''},
                'text': "ACOF (91) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16)
        }
    }
    encodeACOF = function(nodeNumber, eventNumber) {
        return this.header({MinPri: 3}) + '91' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) + ';';
    }


    // 92 AREQ
	// AREQ Format: [<MjPri><MinPri=3><CANID>]<92><NN hi><NN lo><EN hi><EN lo>
    //
    decodeAREQ = function(message) {
		return {'encoded': message,
                'mnemonic': 'AREQ',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {hex:''},
                'text': "AREQ (92) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16)
        }
    }
    encodeAREQ = function(nodeNumber, eventNumber) {
        return this.header({MinPri: 3}) + '92' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) + ';';
    }


    // 93 ARON
	// ARON Format: [<MjPri><MinPri=3><CANID>]<93><NN hi><NN lo><EN hi><EN lo>
    //
    decodeARON = function(message) {
		return {'encoded': message,
                'mnemonic': 'ARON',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {hex:''},
                'text': "ARON (93) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16)
        }
    }
    encodeARON = function(nodeNumber, eventNumber) {
        return this.header({MinPri: 3}) + '93' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) + ';';
    }


    // 94 AROF
	// AROF Format: [<MjPri><MinPri=3><CANID>]<94><NN hi><NN lo><EN hi><EN lo>
    //
    decodeAROF = function(message) {
		return {'encoded': message,
                'mnemonic': 'AROF',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {hex:''},
                'text': "AROF (94) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16)
        }
    }
    encodeAROF = function(nodeNumber, eventNumber) {
        return this.header({MinPri: 3}) + '94' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) + ';';
    }


    // 95 EVULN
	// EVULN Format: [<MjPri><MinPri=3><CANID>]<95><NN hi><NN lo><EN hi><EN lo>
    //
    decodeEVULN = function(message) {
        return {'encoded': message,
                'mnemonic': 'EVULN',
                'opCode': message.substr(7, 2),
                'eventName': message.substr(9, 8),
                'text': "EVULN (95) eventName " + message.substr(9, 8),
        }
    }
    encodeEVULN = function(eventName) {
        return this.header({MinPri: 3}) + '95' + eventName + ';'
    }


    // 96 NVSET
	// NVSET Format: [<MjPri><MinPri=3><CANID>]<96><NN hi><NN lo><NV# ><NV val>
    //
    decodeNVSET = function(message) {
        return {'encoded': message,
                'mnemonic': 'NVSET',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'nodeVariableIndex': parseInt(message.substr(13, 2), 16), 
                'nodeVariableValue': parseInt(message.substr(15, 2), 16), 
                'text':  "NVSET (96) Node " + parseInt(message.substr(9, 4), 16) + 
					" Node Variable Index " + parseInt(message.substr(13, 2), 16) +
					" Node Variable Value " + parseInt(message.substr(15, 2), 16)
        }
    }
    encodeNVSET = function(nodeNumber, nodeVariableIndex, nodeVariableValue) {
        return this.header({MinPri: 3}) + '96' + decToHex(nodeNumber, 4) + decToHex(nodeVariableIndex, 2) + decToHex(nodeVariableValue, 2) + ';'
    }


    // 97 NVANS
    //
    decodeNVANS = function(message) {
        // NVANS Format: [[<MjPri><MinPri=3><CANID>]<97><NN hi><NN lo><NV# ><NV val>
        return {'encoded': message,
                'mnemonic': 'NVANS',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'nodeVariableIndex': parseInt(message.substr(13, 2), 16),
                'nodeVariableValue': parseInt(message.substr(15, 2), 16),
                'text':  "NVANS (97) Node " + parseInt(message.substr(9, 4), 16) + 
					" Node Variable Index " + parseInt(message.substr(13, 2), 16) +
					" Node Variable Value " + parseInt(message.substr(15, 2), 16)
        }
    }
    encodeNVANS = function(nodeNumber, nodeVariableIndex, nodeVariableValue) {
        return this.header({MinPri: 3}) + '97' + decToHex(nodeNumber, 4) + decToHex(nodeVariableIndex, 2) + decToHex(nodeVariableValue, 2) + ';'
    }
    

    // 98 ASON
	// ASON Format: [<MjPri><MinPri=3><CANID>]<98><NN hi><NN lo><DN hi><DN lo>
    //
    decodeASON = function(message) {
		return {'encoded': message,
                'mnemonic': 'ASON',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {hex:''},
                'text': "ASON (98) Node " + parseInt(message.substr(9, 4), 16) + 
					" Device Number " + parseInt(message.substr(13, 4), 16)
        }
    }
    encodeASON = function(nodeNumber, deviceNumber) {
        return this.header({MinPri: 3}) + '98' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) + ';';
    }


    // 99 ASOF
	// ASOF Format: [<MjPri><MinPri=3><CANID>]<99><NN hi><NN lo><DN hi><DN lo>
    //
    decodeASOF = function(message) {
		return {'encoded': message,
                'mnemonic': 'ASOF',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {hex:''},
                'text': "ASOF (99) Node " + parseInt(message.substr(9, 4), 16) + 
					" Device Number " + parseInt(message.substr(13, 4), 16)
        }
    }
    encodeASOF = function(nodeNumber, deviceNumber) {
        return this.header({MinPri: 3}) + '99' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) + ';';
    }


    // 9A ASRQ
	// ASRQ Format: [<MjPri><MinPri=3><CANID>]<9A><NN hi><NN lo><DN hi><DN lo>
    //
    decodeASRQ = function(message) {
		return {'encoded': message,
                'mnemonic': 'ASRQ',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventData': {hex:''},
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'text': "ASRQ (9A) Node " + parseInt(message.substr(9, 4), 16) + 
					" Device Number " + parseInt(message.substr(13, 4), 16)
        }
    }
    encodeASRQ = function(nodeNumber, deviceNumber) {
        return this.header({MinPri: 3}) + '9A' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) + ';';
    }


    // 9B PARAN
    // PARAN Format: [<MjPri><MinPri=3><CANID>]<9B><NN hi><NN lo><Para#><Para val>
    //
    decodePARAN = function(message) {
        return {'encoded': message,
                'mnemonic': 'PARAN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'parameterIndex': parseInt(message.substr(13, 2), 16),
                'parameterValue': parseInt(message.substr(15, 2), 16),
                'text': "PARAN (9B) Node " + parseInt(message.substr(9, 4), 16) + 
					" Parameter Index " + parseInt(message.substr(13, 2), 16) + 
					" Parameter Value " + parseInt(message.substr(15, 2), 16)
        }
    }
    encodePARAN = function(nodeNumber, parameterIndex, parameterValue) {
        return this.header({MinPri: 3}) + '9B' + decToHex(nodeNumber, 4) + decToHex(parameterIndex, 2) + decToHex(parameterValue, 2) + ';'
    }


    // 9C REVAL
    // REVAL Format: [<MjPri><MinPri=3><CANID>]<9C><NN hi><NN lo><EN#><EV#>
    //
    decodeREVAL = function(message) {
        return {'encoded': message,
                'mnemonic': 'REVAL',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventIndex': parseInt(message.substr(13, 2), 16), 
                'eventVariableIndex': parseInt(message.substr(15, 2), 16), 
                'text': "REVAL (9C) Node " + parseInt(message.substr(9, 4), 16) + 
					" Event Index " + parseInt(message.substr(13, 2), 16) + 
					" Event VariableIndex " + parseInt(message.substr(15, 2), 16)
        }
    }
    encodeREVAL = function(nodeNumber, eventIndex, eventVariableIndex) {
        return this.header({MinPri: 3}) + '9C' + decToHex(nodeNumber, 4) + decToHex(eventIndex, 2) + decToHex(eventVariableIndex, 2) + ';'
    }


    // 9D ARSON
	// ARSON Format: [<MjPri><MinPri=3><CANID>]<9D><NN hi><NN lo><DN hi><DN lo>
    //
    decodeARSON = function(message) {
		return {'encoded': message,
                'mnemonic': 'ARSON',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventData': {hex:''},
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'text': "ARSON (9D) Node " + parseInt(message.substr(9, 4), 16) + 
					" Device Number " + parseInt(message.substr(13, 4), 16)
        }
    }
    encodeARSON = function(nodeNumber, deviceNumber) {
        return this.header({MinPri: 3}) + '9D' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) + ';';
    }


    // 9E ARSOF
	// ARSOF Format: [<MjPri><MinPri=3><CANID>]<9F><NN hi><NN lo><DN hi><DN lo>
    //
    decodeARSOF = function(message) {
		return {'encoded': message,
                'mnemonic': 'ARSOF',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventData': {hex:''},
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'text': "ARSOF (9E) Node " + parseInt(message.substr(9, 4), 16) + 
					" Device Number " + parseInt(message.substr(13, 4), 16)
        }
    }
    encodeARSOF = function(nodeNumber, deviceNumber) {
        return this.header({MinPri: 3}) + '9E' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) + ';';
    }


    // 9F EXTC3
	// EXTC3 Format: [<MjPri><MinPri=3><CANID>]<9F><Ext_OPC><byte1><byte2><byte3>
    //
    decodeEXTC3 = function(message) {
		return {'encoded': message,
                'mnemonic': 'EXTC3',
                'opCode': message.substr(7, 2),
                'Ext_OPC': parseInt(message.substr(9, 2), 16), 
                'byte1': parseInt(message.substr(11, 2), 16),
                'byte2': parseInt(message.substr(13, 2), 16),
                'byte3': parseInt(message.substr(15, 2), 16),
                'text': "EXTC3 (9F) Ext_OPC " + parseInt(message.substr(9, 2), 16) + 
					" byte1 " + parseInt(message.substr(11, 4), 16) +
					" byte2 " + parseInt(message.substr(13, 4), 16) +
					" byte3 " + parseInt(message.substr(15, 4), 16)
        }
    }
    encodeEXTC3 = function(Ext_OPC, byte1, byte2, byte3) {
        return this.header({MinPri: 3}) + '9F' + decToHex(Ext_OPC, 2) + decToHex(byte1, 2) + decToHex(byte2, 2) + decToHex(byte3, 2) + ';';
    }


    // A0 RDCC4
    // RDCC4 Format: <MjPri><MinPri=2><CANID>]<A0><REP><Byte0>..<Byte3>
    //
    decodeRDCC4 = function(message) {
        return {'encoded': message,
                'mnemonic': 'RDCC4',
                'opCode': message.substr(7, 2),
                'repetitions': parseInt(message.substr(9, 2), 16),
                'byte0': parseInt(message.substr(11, 2), 16),
                'byte1': parseInt(message.substr(13, 2), 16),
                'byte2': parseInt(message.substr(15, 2), 16),
                'byte3': parseInt(message.substr(17, 2), 16),
                'text': "RDCC4 (A0) repetitions " + parseInt(message.substr(9, 2), 16) + 
					" byte0 " + parseInt(message.substr(11, 2), 16) +
					" byte1 " + parseInt(message.substr(13, 2), 16) +
					" byte2 " + parseInt(message.substr(15, 2), 16) +
					" byte3 " + parseInt(message.substr(17, 2), 16)
        }
    }
    encodeRDCC4 = function(repetitions, byte0, byte1, byte2, byte3) {
        return this.header({MinPri: 2}) + 'A0' + decToHex(repetitions, 2) + 
                            decToHex(byte0, 2) + 
                            decToHex(byte1, 2) + 
                            decToHex(byte2, 2) + 
                            decToHex(byte3, 2) + ';'
    }
    

    // A2 WCVS
    // WCVS Format: [<MjPri><MinPri=2><CANID>]<A2><Session><High CV#><LowCV#><Mode><CVval>
    //
    decodeWCVS = function(message) {
        return {'encoded': message,
                'mnemonic': 'WCVS',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'CV': parseInt(message.substr(11, 4), 16),
                'mode': parseInt(message.substr(15, 2), 16),
                'value': parseInt(message.substr(17, 2), 16),
                'text': "WCVS (A2) Session " + parseInt(message.substr(9, 2), 16) + 
					" CV " + parseInt(message.substr(11, 4), 16) +
					" Mode " + parseInt(message.substr(15, 2), 16) +
					" Value " + parseInt(message.substr(17, 2), 16)
        }
    }
    encodeWCVS = function(session, CV, mode, value) {
        return this.header({MinPri: 2}) + 'A2' + decToHex(session, 2) + 
                            decToHex(CV, 4) + 
                            decToHex(mode, 2) + 
                            decToHex(value, 2) + ';'
    }
    

    // B0 ACON1
	// ACON1 Format: [<MjPri><MinPri=3><CANID>]<B0><NN hi><NN lo><EN hi><EN lo><data1>
    //
    decodeACON1 = function(message) {
		return {'encoded': message,
                'mnemonic': 'ACON1',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                hex:message.substr(17, 2)},
                'text': "ACON1 (B0) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16)
        }
    }
    encodeACON1 = function(nodeNumber, eventNumber, data1) {
        return this.header({MinPri: 3}) + 'B0' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + ';';
    }


    // B1 ACOF1
	// ACOF1 Format: [<MjPri><MinPri=3><CANID>]<B1><NN hi><NN lo><EN hi><EN lo><data1>
    //
    decodeACOF1 = function(message) {
		return {'encoded': message,
                'mnemonic': 'ACOF1',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                hex:message.substr(17, 2)},
                'text': "ACOF1 (B1) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16)
        }
    }
    encodeACOF1 = function(nodeNumber, eventNumber, data1) {
        return this.header({MinPri: 3}) + 'B1' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + ';';
    }


    // B2 REQEV
	// REQEV Format: [<MjPri><MinPri=3><CANID>]<B2><NN hi><NN lo><EN hi><EN lo><EV# >
    //
    decodeREQEV = function(message) {
		return {'encoded': message,
                'mnemonic': 'REQEV',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventVariableIndex': parseInt(message.substr(17, 2), 16),
                'text': "REQEV (B2) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
					" eventVariableIndex " + parseInt(message.substr(17, 4), 16)
        }
    }
    encodeREQEV = function(nodeNumber, eventNumber, eventVariableIndex) {
        return this.header({MinPri: 3}) + 'B2' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) + decToHex(eventVariableIndex, 2) + ';';
    }


    // B3 ARON1
	// ARON1 Format: [<MjPri><MinPri=3><CANID>]<B3><NN hi><NN lo><EN hi><EN lo><data1>
    //
    decodeARON1 = function(message) {
		return {'encoded': message,
                'mnemonic': 'ARON1',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                hex:message.substr(17, 2)},
                'text': "ARON1 (B3) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16)
        }
    }
    encodeARON1 = function(nodeNumber, eventNumber, data1) {
        return this.header({MinPri: 3}) + 'B3' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + ';';
    }


    // B4 AROF1
	// AROF1 Format: [<MjPri><MinPri=3><CANID>]<B4><NN hi><NN lo><EN hi><EN lo><data1>
    //
    decodeAROF1 = function(message) {
		return {'encoded': message,
                'mnemonic': 'AROF1',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                hex:message.substr(17, 2)},
                'text': "AROF1 (B4) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16)
        }
    }
    encodeAROF1 = function(nodeNumber, eventNumber, data1) {
        return this.header({MinPri: 3}) + 'B4' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + ';';
    }


    // B5 NEVAL
    // NEVAL Format: [<MjPri><MinPri=3><CANID>]<B5><NN hi><NN lo><EN#><EV#><EVval>
    //
    decodeNEVAL = function(message) {
        return {'encoded': message,
                'mnemonic': 'NEVAL',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'eventIndex': parseInt(message.substr(13, 2), 16),
                'eventVariableIndex': parseInt(message.substr(15, 2), 16),
                'eventVariableValue': parseInt(message.substr(17, 2), 16),
                'text': "NEVAL (B5) NodeId " + parseInt(message.substr(9, 4), 16) + 
					" Event Index " + parseInt(message.substr(13, 2), 16) + 
					" Event Variable Index " + parseInt(message.substr(15, 2), 16) + 
					" Event Variable Value " + parseInt(message.substr(17, 2), 16)
        }
    }
    encodeNEVAL = function(nodeNumber, eventIndex, eventVariableIndex, eventVariableValue) {
        return this.header({MinPri: 3}) + 'B5' + decToHex(nodeNumber, 4) + decToHex(eventIndex, 2) + decToHex(eventVariableIndex, 2) + decToHex(eventVariableValue, 2) + ';'
    }


    // B6 PNN
    // PNN Format: [<MjPri><MinPri=3><CANID>]<B6><NN Hi><NN Lo><Manuf Id><Module Id><Flags>
    //
    decodePNN = function(message) {
        return {'encoded': message,
                'mnemonic': 'PNN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'manufacturerId': parseInt(message.substr(13, 2), 16), 
                'moduleId': parseInt(message.substr(15, 2), 16), 
                'flags': parseInt(message.substr(17, 2), 16),
                'text': "PNN (B6) Node " + parseInt(message.substr(9, 4), 16) + 
					" Manufacturer Id " + parseInt(message.substr(13, 2), 16) + 
					" Module Id " + parseInt(message.substr(15, 2), 16) + 
					" Flags " + parseInt(message.substr(17, 2), 16)
        }
    }
    encodePNN = function(nodeNumber, manufacturerId, moduleId, flags) {
        return this.header({MinPri: 3}) + 'B6' + decToHex(nodeNumber, 4) + decToHex(manufacturerId, 2) + decToHex(moduleId, 2) + decToHex(flags, 2) + ';'
    }


    

    // B8 ASON1
    // ASON1 Format: [<MjPri><MinPri=3><CANID>]<B8><NN hi><NN lo><EN hi><EN lo><data1>
    //
    decodeASON1 = function(message) {
		return {'encoded': message,
                'mnemonic': 'ASON1',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16),
                                hex:message.substr(17, 2)},
                'text': "ASON1 (B8) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16)
        }
    }
    encodeASON1 = function(nodeNumber, deviceNumber, data1) {
        return this.header({MinPri: 3}) + 'B8' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + ';';
    }


    // B9 ASOF1
	// ASOF1 Format: [<MjPri><MinPri=3><CANID>]<B9><NN hi><NN lo><EN hi><EN lo><data1>
    //
    decodeASOF1 = function(message) {
		return {'encoded': message,
                'mnemonic': 'ASOF1',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                hex:message.substr(17, 2)},
                'text': "ASOF1 (B9) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16)
        }
    }
    encodeASOF1 = function(nodeNumber, deviceNumber, data1) {
        return this.header({MinPri: 3}) + 'B9' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + ';';
    }


    // BD ARSON1
    // ARSON1 Format: [<MjPri><MinPri=3><CANID>]<BD><NN hi><NN lo><EN hi><EN lo><data1>
    //
    decodeARSON1 = function(message) {
		return {'encoded': message,
                'mnemonic': 'ARSON1',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16),
                                hex:message.substr(17, 2)},
                'text': "ARSON1 (BD) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16)
        }
    }
    encodeARSON1 = function(nodeNumber, deviceNumber, data1) {
        return this.header({MinPri: 3}) + 'BD' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + ';';
    }


    // BE ARSOF1
    // ARSOF1 Format: [<MjPri><MinPri=3><CANID>]<BE><NN hi><NN lo><EN hi><EN lo><data1>
    //
    decodeARSOF1 = function(message) {
		return {'encoded': message,
                'mnemonic': 'ARSOF1',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16),
                                hex:message.substr(17, 2)},
                'text': "ARSOF1 (BE) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16)
        }
    }
    encodeARSOF1 = function(nodeNumber, deviceNumber, data1) {
        return this.header({MinPri: 3}) + 'BE' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + ';';
    }


    // BF EXTC4
	// EXTC4 Format: [<MjPri><MinPri=3><CANID>]<BF><Ext_OPC><byte1><byte2><byte3><byte4>
    //
    decodeEXTC4 = function(message) {
		return {'encoded': message,
                'mnemonic': 'EXTC4',
                'opCode': message.substr(7, 2),
                'Ext_OPC': parseInt(message.substr(9, 2), 16), 
                'byte1': parseInt(message.substr(11, 2), 16),
                'byte2': parseInt(message.substr(13, 2), 16),
                'byte3': parseInt(message.substr(15, 2), 16),
                'byte4': parseInt(message.substr(17, 2), 16),
                'text': "EXTC4 (BF) Ext_OPC " + parseInt(message.substr(9, 2), 16) + 
					" byte1 " + parseInt(message.substr(11, 4), 16) +
					" byte2 " + parseInt(message.substr(13, 4), 16) +
					" byte3 " + parseInt(message.substr(15, 4), 16) +
					" byte4 " + parseInt(message.substr(17, 4), 16)
        }
    }
    encodeEXTC4 = function(Ext_OPC, byte1, byte2, byte3, byte4) {
        return this.header({MinPri: 3}) + 'BF' + decToHex(Ext_OPC, 2) + 
                            decToHex(byte1, 2) + 
                            decToHex(byte2, 2) + 
                            decToHex(byte3, 2) + 
                            decToHex(byte4, 2) + ';';
    }


    // C0 RDCC5
    // RDCC5 Format: <MjPri><MinPri=2><CANID>]<A0><REP><Byte0>..<Byte4>
    //
    decodeRDCC5 = function(message) {
        return {'encoded': message,
                'mnemonic': 'RDCC5',
                'opCode': message.substr(7, 2),
                'repetitions': parseInt(message.substr(9, 2), 16),
                'byte0': parseInt(message.substr(11, 2), 16),
                'byte1': parseInt(message.substr(13, 2), 16),
                'byte2': parseInt(message.substr(15, 2), 16),
                'byte3': parseInt(message.substr(17, 2), 16),
                'byte4': parseInt(message.substr(19, 2), 16),
                'text': "RDCC5 (C0) repetitions " + parseInt(message.substr(9, 2), 16) + 
					" byte0 " + parseInt(message.substr(11, 2), 16) +
					" byte1 " + parseInt(message.substr(13, 2), 16) +
					" byte2 " + parseInt(message.substr(15, 2), 16) +
					" byte3 " + parseInt(message.substr(17, 2), 16) +
					" byte4 " + parseInt(message.substr(19, 2), 16)
        }
    }
    encodeRDCC5 = function(repetitions, byte0, byte1, byte2, byte3, byte4) {
        return this.header({MinPri: 2}) + 'C0' + decToHex(repetitions, 2) + 
                            decToHex(byte0, 2) + 
                            decToHex(byte1, 2) + 
                            decToHex(byte2, 2) + 
                            decToHex(byte3, 2) + 
                            decToHex(byte4, 2) + ';'
    }
    

    // C1 WCVOA
    // WCVOA Format: [<MjPri><MinPri=2><CANID>]<C1><AddrH><AddrL><High CV#><Low CV#><Mode><Val>
    //
    decodeWCVOA = function(message) {
        return {'encoded': message,
                'mnemonic': 'WCVOA',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'CV': parseInt(message.substr(11, 4), 16),
                'mode': parseInt(message.substr(15, 2), 16),
                'value': parseInt(message.substr(17, 2), 16),
                'text': "WCVOA (C1) session " + parseInt(message.substr(9, 2), 16) + 
					" CV " + parseInt(message.substr(11, 4), 16) +
					" mode " + parseInt(message.substr(15, 2), 16) +
					" value " + parseInt(message.substr(17, 2), 16)
        }
    }
    encodeWCVOA = function(session, CV, mode, value) {
        return this.header({MinPri: 2}) + 'C1' + decToHex(session, 2) + decToHex(CV, 4) + decToHex(mode, 2) + decToHex(value, 2) + ';'
    }
    

    // CF FCLK
    // FCLK Format: <MjPri><MinPri=3><CANID>]<CF><mins><hrs><wdmon><div><mday><temp>
    //
    decodeFCLK = function(message) {
        return {'encoded': message,
                'mnemonic': 'FCLK',
                'opCode': message.substr(7, 2),
                'minutes': parseInt(message.substr(9, 2), 16),
                'hours': parseInt(message.substr(11, 2), 16),
                'wdmon': parseInt(message.substr(13, 2), 16),
                'div': parseInt(message.substr(15, 2), 16),
                'mday': parseInt(message.substr(17, 2), 16),
                'temp': parseInt(message.substr(19, 2), 16),
                'weekDay': parseInt(message.substr(13, 2), 16)%16,
                'month': parseInt(message.substr(13, 2), 16) >> 4,
                'text': "FCLK (CF) minutes " + parseInt(message.substr(9, 2), 16) + 
					" hours " + parseInt(message.substr(11, 4), 16) +
					" wdmon " + parseInt(message.substr(13, 2), 16) +
					" div " + parseInt(message.substr(15, 2), 16) +
					" mday " + parseInt(message.substr(17, 2), 16) +
					" temp " + parseInt(message.substr(19, 2), 16)
        }
    }
    encodeFCLK = function(minutes, hours, wdmon, div, mday, temp) {
        return this.header({MinPri: 3}) + 'CF' + 
                            decToHex(minutes, 2) + 
                            decToHex(hours, 2) + 
                            decToHex(wdmon, 2) + 
                            decToHex(div, 2) + 
                            decToHex(mday, 2) + 
                            decToHex(temp, 2) + ';'
    }
    

    // D0 ACON2
	// ACON2 Format: [<MjPri><MinPri=3><CANID>]<D0><NN hi><NN lo><EN hi><EN lo><data1><data2>
    //
    decodeACON2 = function(message) {
		return {'encoded': message,
                'mnemonic': 'ACON2',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                hex:message.substr(17, 4)},
                'text': "ACON2 (D0) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16)
        }
    }
    encodeACON2 = function(nodeNumber, eventNumber, data1, data2) {
        return this.header({MinPri: 3}) + 'D0' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + ';';
    }


    // D1 ACOF2
	// ACOF2 Format: [<MjPri><MinPri=3><CANID>]<D1><NN hi><NN lo><EN hi><EN lo><data1><data2>
    //
    decodeACOF2 = function(message) {
		return {'encoded': message,
                'mnemonic': 'ACOF2',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                hex:message.substr(17, 4)},
                'text': "ACOF2 (D1) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16)
        }
    }
    encodeACOF2 = function(nodeNumber, eventNumber, data1, data2) {
        return this.header({MinPri: 3}) + 'D1' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + ';';
    }


    // D2 EVLRN
	// EVLRN Format: [<MjPri><MinPri=3><CANID>]<D2><NN hi><NN lo><EN hi><EN lo><EV#><EV val>
    //
    decodeEVLRN = function(message) {
        return {'encoded': message,
                'mnemonic': 'EVLRN',
                'opCode': message.substr(7, 2),
                'eventName': message.substr(9, 8),
                'eventVariableIndex': parseInt(message.substr(17, 2), 16),
                'eventVariableValue': parseInt(message.substr(19, 2), 16),
                'text': "EVLRN (D2) eventName " + message.substr(9, 8) + 
					" Event Variable Index " + parseInt(message.substr(17, 2), 16) + 
					" Event Variable Value " + parseInt(message.substr(19, 2), 16)
        }
    }
    encodeEVLRN = function(eventName, eventVariableIndex, eventVariableValue) {
        return this.header({MinPri: 3}) + 'D2' + eventName + decToHex(eventVariableIndex, 2) + decToHex(eventVariableValue, 2) + ';'
    }
    

    // D3 EVANS
	// EVANS Format: [<MjPri><MinPri=3><CANID>]<D3><NN hi><NN lo><EN hi><EN lo><EV#><EV val>
    //
    decodeEVANS = function(message) {
        return {'encoded': message,
                'mnemonic': 'EVANS',
                'opCode': message.substr(7, 2),
                'eventName': message.substr(9, 8),
                'eventVariableIndex': parseInt(message.substr(17, 2), 16),
                'eventVariableValue': parseInt(message.substr(19, 2), 16),
                'text': "EVANS (D3) eventName " + message.substr(9, 8) + 
					" Event Variable Index " + parseInt(message.substr(17, 2), 16) + 
					" Event Variable Value " + parseInt(message.substr(19, 2), 16)
        }
    }
    encodeEVANS = function(eventName, eventVariableIndex, eventVariableValue) {
        return this.header({MinPri: 3}) + 'D3' + eventName + decToHex(eventVariableIndex, 2) + decToHex(eventVariableValue, 2) + ';'
    }
    

    // D4 ARON2
	// ARON2 Format: [<MjPri><MinPri=3><CANID>]<D4><NN hi><NN lo><EN hi><EN lo><data1><data2>
    //
    decodeARON2 = function(message) {
		return {'encoded': message,
                'mnemonic': 'ARON2',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                hex:message.substr(17, 4)},
                'text': "ARON2 (D4) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16)
        }
    }
    encodeARON2 = function(nodeNumber, eventNumber, data1, data2) {
        return this.header({MinPri: 3}) + 'D4' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + ';';
    }


    // D5 AROF2
	// AROF2 Format: [<MjPri><MinPri=3><CANID>]<D5><NN hi><NN lo><EN hi><EN lo><data1><data2>
    //
    decodeAROF2 = function(message) {
		return {'encoded': message,
                'mnemonic': 'AROF2',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                hex:message.substr(17, 4)},
                'text': "AROF2 (D5) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16)
        }
    }
    encodeAROF2 = function(nodeNumber, eventNumber, data1, data2) {
        return this.header({MinPri: 3}) + 'D5' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + ';';
    }


    // D8 ASON2
	// ASON2 Format: [<MjPri><MinPri=3><CANID>]<D8><NN hi><NN lo><EN hi><EN lo><data1><data2>
    //
    decodeASON2 = function(message) {
		return {'encoded': message,
                'mnemonic': 'ASON2',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                hex:message.substr(17, 4)},
                'text': "ASON2 (D8) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16)
        }
    }
    encodeASON2 = function(nodeNumber, deviceNumber, data1, data2) {
        return this.header({MinPri: 3}) + 'D8' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + ';';
    }


    // D9 ASOF2
	// ASOF2 Format: [<MjPri><MinPri=3><CANID>]<D9><NN hi><NN lo><EN hi><EN lo><data1><data2>
    //
    decodeASOF2 = function(message) {
		return {'encoded': message,
                'mnemonic': 'ASOF2',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                hex:message.substr(17, 4)},
                'text': "ASOF2 (D9) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16)
        }
    }
    encodeASOF2 = function(nodeNumber, deviceNumber, data1, data2) {
        return this.header({MinPri: 3}) + 'D9' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + ';';
    }


    // DD ARSON2
	// ARSON2 Format: [<MjPri><MinPri=3><CANID>]<DD><NN hi><NN lo><EN hi><EN lo><data1><data2>
    //
    decodeARSON2 = function(message) {
		return {'encoded': message,
                'mnemonic': 'ARSON2',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                hex:message.substr(17, 4)},
                'text': "ARSON2 (DD) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16)
        }
    }
    encodeARSON2 = function(nodeNumber, deviceNumber, data1, data2) {
        return this.header({MinPri: 3}) + 'DD' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + ';';
    }


    // DE ARSOF2
	// ARSOF2 Format: [<MjPri><MinPri=3><CANID>]<DE><NN hi><NN lo><EN hi><EN lo><data1><data2>
    //
    decodeARSOF2 = function(message) {
		return {'encoded': message,
                'mnemonic': 'ARSOF2',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                hex:message.substr(17, 4)},
                'text': "ARSOF2 (DE) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16)
        }
    }
    encodeARSOF2 = function(nodeNumber, deviceNumber, data1, data2) {
        return this.header({MinPri: 3}) + 'DE' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + ';';
    }


    // DF EXTC5
	// EXTC5 Format: [<MjPri><MinPri=3><CANID>]<DF><Ext_OPC><byte1><byte2><byte3><byte4><byte5>
    //
    decodeEXTC5 = function(message) {
		return {'encoded': message,
                'mnemonic': 'EXTC5',
                'opCode': message.substr(7, 2),
                'Ext_OPC': parseInt(message.substr(9, 2), 16), 
                'byte1': parseInt(message.substr(11, 2), 16),
                'byte2': parseInt(message.substr(13, 2), 16),
                'byte3': parseInt(message.substr(15, 2), 16),
                'byte4': parseInt(message.substr(17, 2), 16),
                'byte5': parseInt(message.substr(19, 2), 16),
                'text': "EXTC5 (DF) Ext_OPC " + parseInt(message.substr(9, 2), 16) + 
					" byte1 " + parseInt(message.substr(11, 4), 16) +
					" byte2 " + parseInt(message.substr(13, 4), 16) +
					" byte3 " + parseInt(message.substr(15, 4), 16) +
					" byte4 " + parseInt(message.substr(17, 4), 16) +
					" byte5 " + parseInt(message.substr(19, 4), 16)
        }
    }
    encodeEXTC5 = function(Ext_OPC, byte1, byte2, byte3, byte4, byte5) {
        return this.header({MinPri: 3}) + 'DF' + decToHex(Ext_OPC, 2) + 
                            decToHex(byte1, 2) + 
                            decToHex(byte2, 2) + 
                            decToHex(byte3, 2) + 
                            decToHex(byte4, 2) + 
                            decToHex(byte5, 2) + ';';
    }


    // E0 RDCC6
    // RDCC6 Format: <MjPri><MinPri=2><CANID>]<A0><REP><Byte0>..<Byte5>
    //
    decodeRDCC6 = function(message) {
        return {'encoded': message,
                'mnemonic': 'RDCC6',
                'opCode': message.substr(7, 2),
                'repetitions': parseInt(message.substr(9, 2), 16),
                'byte0': parseInt(message.substr(11, 2), 16),
                'byte1': parseInt(message.substr(13, 2), 16),
                'byte2': parseInt(message.substr(15, 2), 16),
                'byte3': parseInt(message.substr(17, 2), 16),
                'byte4': parseInt(message.substr(19, 2), 16),
                'byte5': parseInt(message.substr(21, 2), 16),
                'text': "RDCC6 (E0) repetitions " + parseInt(message.substr(9, 2), 16) + 
					" byte0 " + parseInt(message.substr(11, 2), 16) +
					" byte1 " + parseInt(message.substr(13, 2), 16) +
					" byte2 " + parseInt(message.substr(15, 2), 16) +
					" byte3 " + parseInt(message.substr(17, 2), 16) +
					" byte4 " + parseInt(message.substr(19, 2), 16) +
					" byte5 " + parseInt(message.substr(21, 2), 16)
        }
    }
    encodeRDCC6 = function(repetitions, byte0, byte1, byte2, byte3, byte4, byte5) {
        return this.header({MinPri: 2}) + 'E0' + decToHex(repetitions, 2) + 
                            decToHex(byte0, 2) + 
                            decToHex(byte1, 2) + 
                            decToHex(byte2, 2) + 
                            decToHex(byte3, 2) + 
                            decToHex(byte4, 2) + 
                            decToHex(byte5, 2) + ';'
    }
    

    // E1 PLOC
    // PLOC Format: [<MjPri><MinPri=2><CANID>]<E1><Session><AddrH><AddrL><Speed/Dir><Fn1><Fn2><Fn3>
    //
    decodePLOC = function(message) {
        var speedDir = parseInt(message.substr(15, 2), 16)
        var direction = (speedDir > 127) ? 'Forward' : 'Reverse';
        return {'encoded': message,
                'mnemonic': 'PLOC',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'address': parseInt(message.substr(11, 4), 16),
                'speed': speedDir % 128,
                'direction': direction,
                'Fn1': parseInt(message.substr(17, 2), 16),
                'Fn2': parseInt(message.substr(19, 2), 16),
                'Fn3': parseInt(message.substr(21, 2), 16),
                'text': "PLOC (E1) Session " + parseInt(message.substr(9, 2), 16) + 
					" Address " + parseInt(message.substr(11, 4), 16) +
					" Speed/Dir " + speedDir % 128 +
					" Direction " + direction +
					" Fn1 " + parseInt(message.substr(17, 2), 16) +
					" Fn2 " + parseInt(message.substr(19, 2), 16) +
					" Fn3 " + parseInt(message.substr(21, 2), 16)
        }
    }
    encodePLOC = function(session, address, speed, direction, Fn1, Fn2, Fn3) {
        var speedDir = speed + parseInt((direction == 'Reverse') ? 0 : 128)
        return this.header({MinPri: 2}) + 'E1' + decToHex(session, 2) + decToHex(address, 4) + decToHex(speedDir, 2) + decToHex(Fn1, 2) + decToHex(Fn2, 2) + decToHex(Fn3, 2) + ';';
    }
    

    // E2 NAME
    // NAME Format: [<MjPri><MinPri=3><CANID>]<E2><char1><char2><char3><char4><char5><char6><char7>
    //
    decodeNAME = function(message) {
        return {'encoded': message,
                'mnemonic': 'NAME',
                'opCode': message.substr(7, 2),
                'name': hexToString(message.substr(9, 14)),
                'text': "NAME (E2) name " + hexToString(message.substr(9, 14)) 
        }
    }
    encodeNAME = function(name) {
        return this.header({MinPri: 3}) + 'E2' + stringToHex(name.padEnd(7).substr(0,7)) + ';'
    }
    

    // E3 STAT
    // STAT Format: [<MjPri><MinPri=2><CANID>]<E3><NN hi><NN lo><CS num><flags>
    //               <Major rev><Minor rev><Build no.>   
    //
    decodeSTAT = function(message) {
        return {'encoded': message,
                'mnemonic': 'STAT',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'CS': parseInt(message.substr(13, 2), 16),
                'flags': parseInt(message.substr(15, 2), 16),
                'major': parseInt(message.substr(17,2), 16),
                'minor': parseInt(message.substr(19, 2), 16),
                'build': parseInt(message.substr(21, 2), 16),
                'text': "STAT (E3) nodeNumber " + parseInt(message.substr(9, 4), 16) +
                                " CS " + parseInt(message.substr(13, 2), 16) +
                                " flags " + parseInt(message.substr(15, 2), 16) +
                                " major " + parseInt(message.substr(17, 2), 16) +
                                " minor " + parseInt(message.substr(19, 2), 16) +
                                " build " + parseInt(message.substr(21, 2), 16)
        }
    }
    encodeSTAT = function(nodeNumber, CS, flags, major, minor, build) {
        return this.header({MinPri: 2}) + 'E3'  + decToHex(nodeNumber, 4) +
                                            decToHex(CS, 2) +
                                            decToHex(flags, 2) +
                                            decToHex(major, 2) +
                                            decToHex(minor, 2) +
                                            decToHex(build, 2) + ';'
    }
    

    // EF PARAMS
    // PARAMS Format: [<MjPri><MinPri=3><CANID>]<EF><PARA 1><PARA 2><PARA 3><PARA 4><PARA 5><PARA 6><PARA 7>
    //
    decodePARAMS = function(message) {
        return {'encoded': message,
                'mnemonic': 'PARAMS',
                'opCode': message.substr(7, 2),
                'param1': parseInt(message.substr(9, 2), 16),
                'param2': parseInt(message.substr(11, 2), 16),
                'param3': parseInt(message.substr(13, 2), 16),
                'param4': parseInt(message.substr(15, 2), 16),
                'param5': parseInt(message.substr(17, 2), 16),
                'param6': parseInt(message.substr(19, 2), 16),
                'param7': parseInt(message.substr(21, 2), 16),
                'text': "PARAMS (EF) param1 " + parseInt(message.substr(9, 2), 16) + 
					" param2 " + parseInt(message.substr(11, 2), 16) +
					" param3 " + parseInt(message.substr(13, 2), 16) +
					" param4 " + parseInt(message.substr(15, 2), 16) +
					" param5 " + parseInt(message.substr(17, 2), 16) +
					" param6 " + parseInt(message.substr(19, 2), 16) +
					" param7 " + parseInt(message.substr(21, 2), 16)
        }
    }
    encodePARAMS = function(param1, param2, param3, param4, param5, param6, param7) {
        return this.header({MinPri: 3}) + 'EF' + decToHex(param1, 2) + 
                            decToHex(param2, 2) + 
                            decToHex(param3, 2) + 
                            decToHex(param4, 2) + 
                            decToHex(param5, 2) + 
                            decToHex(param6, 2) + 
                            decToHex(param7, 2) + ';'
    }
    

    // F0 ACON3
	// ACON3 Format: [<MjPri><MinPri=3><CANID>]<F0><NN hi><NN lo><EN hi><EN lo><data1><data2><data3>
    //
    decodeACON3 = function(message) {
		return {'encoded': message,
                'mnemonic': 'ACON3',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                data3: parseInt(message.substr(21, 2), 16),
                                hex:message.substr(17, 6)},
                'text': "ACON3 (F0) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16) +
                    " data3 " + parseInt(message.substr(21, 2), 16)
        }
    }
    encodeACON3 = function(nodeNumber, eventNumber, data1, data2, data3) {
        return this.header({MinPri: 3}) + 'F0' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + decToHex(data3, 2) + ';';
    }


    // F1 ACOF3
	// ACOF3 Format: [<MjPri><MinPri=3><CANID>]<F1><NN hi><NN lo><EN hi><EN lo><data1><data2><data3>
    //
    decodeACOF3 = function(message) {
		return {'encoded': message,
                'mnemonic': 'ACOF3',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                data3: parseInt(message.substr(21, 2), 16),
                                hex:message.substr(17, 6)},
                'text': "ACOF3 (F1) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16) +
                    " data3 " + parseInt(message.substr(21, 2), 16)
        }
    }
    encodeACOF3 = function(nodeNumber, eventNumber, data1, data2, data3) {
        return this.header({MinPri: 3}) + 'F1' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + decToHex(data3, 2) + ';';
    }


    // F2 ENRSP
    // ENRSP Format: [<MjPri><MinPri=3><CANID>]<F2><NN hi><NN lo><EN3><EN2><EN1><EN0><EN#>
    //
    decodeENRSP = function(message) {
        return {'encoded': message,
                'mnemonic': 'ENRSP',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'eventName': message.substr(13, 8),
                'eventIndex': parseInt(message.substr(21, 2), 16),
                'text': "ENRSP (F2) Node " + parseInt(message.substr(9, 4), 16) + 
					" EventName " + message.substr(13, 8) + 
					" Event Index " + parseInt(message.substr(21, 2), 16)
        }
    }
    encodeENRSP = function(nodeNumber, eventName, eventIndex) {
        return this.header({MinPri: 3}) + 'F2' + decToHex(nodeNumber, 4) + eventName + decToHex(eventIndex, 2) + ';';
    }


    // F3 ARON3
	// ARON3 Format: [<MjPri><MinPri=3><CANID>]<F3><NN hi><NN lo><EN hi><EN lo><data1><data2><data3>
    //
    decodeARON3 = function(message) {
		return {'encoded': message,
                'mnemonic': 'ARON3',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                data3: parseInt(message.substr(21, 2), 16), 
                                hex:message.substr(17, 6)},
                'text': "ARON3 (F3) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16) +
                    " data3 " + parseInt(message.substr(21, 2), 16)
        }
    }
    encodeARON3 = function(nodeNumber, eventNumber, data1, data2, data3) {
        return this.header({MinPri: 3}) + 'F3' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + decToHex(data3, 2) + ';';
    }


    // F4 AROF3
	// AROF3 Format: [<MjPri><MinPri=3><CANID>]<F4><NN hi><NN lo><EN hi><EN lo><data1><data2><data3>
    //
    decodeAROF3 = function(message) {
		return {'encoded': message,
                'mnemonic': 'AROF3',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                data3: parseInt(message.substr(21, 2), 16), 
                                hex:message.substr(17, 6)},
                'text': "AROF3 (F4) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16) +
                    " data3 " + parseInt(message.substr(21, 2), 16)
        }
    }
    encodeAROF3 = function(nodeNumber, eventNumber, data1, data2, data3) {
        return this.header({MinPri: 3}) + 'F4' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + decToHex(data3, 2) + ';';
    }


    // F5 EVLRNI
	// EVLRNI Format: [<MjPri><MinPri=3><CANID>]<F5><NN hi><NN lo><EN hi><EN lo>
    //                  <EN#><EV#><EV val>
    //
    decodeEVLRNI = function(message) {
        return {'encoded': message,
                'mnemonic': 'EVLRNI',
                'opCode': message.substr(7, 2),
                'eventName': message.substr(9, 8),
                'eventNumberIndex': parseInt(message.substr(17, 2), 16),
                'eventVariableIndex': parseInt(message.substr(19, 2), 16),
                'eventVariableValue': parseInt(message.substr(21, 2), 16),
                'text': "EVLRNI (F5) eventName " + message.substr(9, 8) + 
					" Event Number Index " + parseInt(message.substr(17, 2), 16) + 
					" Event Variable Index " + parseInt(message.substr(19, 2), 16) + 
					" Event Variable Value " + parseInt(message.substr(21, 2), 16)
        }
    }
    encodeEVLRNI = function(eventName, eventNumberIndex, eventVariableIndex, eventVariableValue) {
        return this.header({MinPri: 3}) + 'F5' + eventName + decToHex(eventNumberIndex, 2) + decToHex(eventVariableIndex, 2) + decToHex(eventVariableValue, 2) + ';'
    }
    

    // F6 ACDAT
    // ACDAT Format: [<MjPri><MinPri=3><CANID>]<F6><NN hi><NNlo>
    //              <data1><data2><data3><data4><data5>   
    //
    decodeACDAT = function(message) {
        return {'encoded': message,
                'mnemonic': 'ACDAT',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'data1': parseInt(message.substr(13, 2), 16),
                'data2': parseInt(message.substr(15, 2), 16),
                'data3': parseInt(message.substr(17, 2), 16),
                'data4': parseInt(message.substr(19, 2), 16),
                'data5': parseInt(message.substr(21, 2), 16),
                'text': "ACDAT (F6) nodeNumber " + parseInt(message.substr(9, 4), 16) +
                                " data1 " + parseInt(message.substr(13, 2), 16) +
                                " data2 " + parseInt(message.substr(15, 2), 16) +
                                " data3 " + parseInt(message.substr(17, 2), 16) +
                                " data4 " + parseInt(message.substr(19, 2), 16) +
                                " data5 " + parseInt(message.substr(21, 2), 16)
        }
    }
    encodeACDAT = function(nodeNumber, data1, data2, data3, data4, data5) {
        return this.header({MinPri: 2}) + 'F6'  + decToHex(nodeNumber, 4) +
                                            decToHex(data1, 2) +
                                            decToHex(data2, 2) +
                                            decToHex(data3, 2) +
                                            decToHex(data4, 2) +
                                            decToHex(data5, 2) + ';'
    }
    

    // F7 ARDAT
    // ARDAT Format: [<MjPri><MinPri=3><CANID>]<F7><NN hi><NNlo>
    //              <data1><data2><data3><data4><data5>   
    //
    decodeARDAT = function(message) {
        return {'encoded': message,
                'mnemonic': 'ARDAT',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'data1': parseInt(message.substr(13, 2), 16),
                'data2': parseInt(message.substr(15, 2), 16),
                'data3': parseInt(message.substr(17, 2), 16),
                'data4': parseInt(message.substr(19, 2), 16),
                'data5': parseInt(message.substr(21, 2), 16),
                'text': "ARDAT (F7) nodeNumber " + parseInt(message.substr(9, 4), 16) +
                                " data1 " + parseInt(message.substr(13, 2), 16) +
                                " data2 " + parseInt(message.substr(15, 2), 16) +
                                " data3 " + parseInt(message.substr(17, 2), 16) +
                                " data4 " + parseInt(message.substr(19, 2), 16) +
                                " data5 " + parseInt(message.substr(21, 2), 16)
        }
    }
    encodeARDAT = function(nodeNumber, data1, data2, data3, data4, data5) {
        return this.header({MinPri: 2}) + 'F7'  + decToHex(nodeNumber, 4) +
                                            decToHex(data1, 2) +
                                            decToHex(data2, 2) +
                                            decToHex(data3, 2) +
                                            decToHex(data4, 2) +
                                            decToHex(data5, 2) + ';'
    }
    

    // F8 ASON3
	// ASON3 Format: [<MjPri><MinPri=3><CANID>]<F8><NN hi><NN lo><EN hi><EN lo><data1><data2><data3>
    //
    decodeASON3 = function(message) {
		return {'encoded': message,
                'mnemonic': 'ASON3',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                data3: parseInt(message.substr(21, 2), 16),
                                hex:message.substr(17, 6)},
                'text': "ASON3 (F8) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16) +
                    " data3 " + parseInt(message.substr(21, 2), 16)
        }
    }
    encodeASON3 = function(nodeNumber, deviceNumber, data1, data2, data3) {
        return this.header({MinPri: 3}) + 'F8' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + decToHex(data3, 2) + ';';
    }


    // F9 ASOF3
	// ASOF3 Format: [<MjPri><MinPri=3><CANID>]<F9><NN hi><NN lo><EN hi><EN lo><data1><data2><data3>
    //
    decodeASOF3 = function(message) {
		return {'encoded': message,
                'mnemonic': 'ASOF3',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                data3: parseInt(message.substr(21, 2), 16),
                                hex:message.substr(17, 6)},
                'text': "ASOF3 (F9) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16) +
                    " data3 " + parseInt(message.substr(21, 2), 16)
        }
    }
    encodeASOF3 = function(nodeNumber, deviceNumber, data1, data2, data3) {
        return this.header({MinPri: 3}) + 'F9' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + decToHex(data3, 2) + ';';
    }


    // FA DDES
    // DDES Format: [<MjPri><MinPri=3><CANID>]<FA><DN hi><DN lo>
    //              <data1><data2><data3><data4><data5>   
    //
    decodeDDES = function(message) {
        return {'encoded': message,
                'mnemonic': 'DDES',
                'opCode': message.substr(7, 2),
                'deviceNumber': parseInt(message.substr(9, 4), 16),
                'data1': parseInt(message.substr(13, 2), 16),
                'data2': parseInt(message.substr(15, 2), 16),
                'data3': parseInt(message.substr(17, 2), 16),
                'data4': parseInt(message.substr(19, 2), 16),
                'data5': parseInt(message.substr(21, 2), 16),
                'text': "DDES (FA) deviceNumber " + parseInt(message.substr(9, 4), 16) +
                                " data1 " + parseInt(message.substr(13, 2), 16) +
                                " data2 " + parseInt(message.substr(15, 2), 16) +
                                " data3 " + parseInt(message.substr(17, 2), 16) +
                                " data4 " + parseInt(message.substr(19, 2), 16) +
                                " data5 " + parseInt(message.substr(21, 2), 16)
        }
    }
    encodeDDES = function(deviceNumber, data1, data2, data3, data4, data5) {
        return this.header({MinPri: 2}) + 'FA'  + decToHex(deviceNumber, 4) +
                                            decToHex(data1, 2) +
                                            decToHex(data2, 2) +
                                            decToHex(data3, 2) +
                                            decToHex(data4, 2) +
                                            decToHex(data5, 2) + ';'
    }
    

    // FB DDRS
    // DDRS Format: [<MjPri><MinPri=3><CANID>]<FB><DN hi><DN lo>
    //              <data1><data2><data3><data4><data5>   
    //
    decodeDDRS = function(message) {
        return {'encoded': message,
                'mnemonic': 'DDRS',
                'opCode': message.substr(7, 2),
                'deviceNumber': parseInt(message.substr(9, 4), 16),
                'data1': parseInt(message.substr(13, 2), 16),
                'data2': parseInt(message.substr(15, 2), 16),
                'data3': parseInt(message.substr(17, 2), 16),
                'data4': parseInt(message.substr(19, 2), 16),
                'data5': parseInt(message.substr(21, 2), 16),
                'text': "DDRS (FB) deviceNumber " + parseInt(message.substr(9, 4), 16) +
                                " data1 " + parseInt(message.substr(13, 2), 16) +
                                " data2 " + parseInt(message.substr(15, 2), 16) +
                                " data3 " + parseInt(message.substr(17, 2), 16) +
                                " data4 " + parseInt(message.substr(19, 2), 16) +
                                " data5 " + parseInt(message.substr(21, 2), 16)
        }
    }
    encodeDDRS = function(deviceNumber, data1, data2, data3, data4, data5) {
        return this.header({MinPri: 2}) + 'FB'  + decToHex(deviceNumber, 4) +
                                            decToHex(data1, 2) +
                                            decToHex(data2, 2) +
                                            decToHex(data3, 2) +
                                            decToHex(data4, 2) +
                                            decToHex(data5, 2) + ';'
    }
    

    // FD ARSON3
	// ARSON3 Format: [<MjPri><MinPri=3><CANID>]<FD><NN hi><NN lo><DN hi><DN lo>
    //                  <data 1><data 2><data 3>
    //
    decodeARSON3 = function(message) {
		return {'encoded': message,
                'mnemonic': 'ARSON3',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                data3: parseInt(message.substr(21, 2), 16), 
                                hex:message.substr(17, 6)},
                'text': "ARSON3 (FD) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16) +
                    " data3 " + parseInt(message.substr(21, 2), 16)
        }
    }
    encodeARSON3 = function(nodeNumber, deviceNumber, data1, data2, data3) {
        return this.header({MinPri: 3}) + 'FD' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + decToHex(data3, 2) + ';';
    }


    // FE ARSOF3
	// ARSOF3 Format: [<MjPri><MinPri=3><CANID>]<FE><NN hi><NN lo><DN hi><DN lo>
    //                  <data 1><data 2><data 3>
    //
    decodeARSOF3 = function(message) {
		return {'encoded': message,
                'mnemonic': 'ARSOF3',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                data3: parseInt(message.substr(21, 2), 16), 
                                hex:message.substr(17, 6)},
                'text': "ARSOF3 (FE) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16) +
                    " data3 " + parseInt(message.substr(21, 2), 16)
        }
    }
    encodeARSOF3 = function(nodeNumber, deviceNumber, data1, data2, data3) {
        return this.header({MinPri: 3}) + 'FE' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + decToHex(data3, 2) + ';';
    }


    // FF EXTC6
	// EXTC6 Format: [<MjPri><MinPri=3><CANID>]<DF><Ext_OPC><byte1><byte2><byte3><byte4><byte5><byte6>
    //
    decodeEXTC6 = function(message) {
		return {'encoded': message,
                'mnemonic': 'EXTC6',
                'opCode': message.substr(7, 2),
                'Ext_OPC': parseInt(message.substr(9, 2), 16), 
                'byte1': parseInt(message.substr(11, 2), 16),
                'byte2': parseInt(message.substr(13, 2), 16),
                'byte3': parseInt(message.substr(15, 2), 16),
                'byte4': parseInt(message.substr(17, 2), 16),
                'byte5': parseInt(message.substr(19, 2), 16),
                'byte6': parseInt(message.substr(21, 2), 16),
                'text': "EXTC6 (FF) Ext_OPC " + parseInt(message.substr(9, 2), 16) + 
					" byte1 " + parseInt(message.substr(11, 4), 16) +
					" byte2 " + parseInt(message.substr(13, 4), 16) +
					" byte3 " + parseInt(message.substr(15, 4), 16) +
					" byte4 " + parseInt(message.substr(17, 4), 16) +
					" byte5 " + parseInt(message.substr(19, 4), 16) +
					" byte6 " + parseInt(message.substr(21, 4), 16)
        }
    }
    encodeEXTC6 = function(Ext_OPC, byte1, byte2, byte3, byte4, byte5, byte6) {
        return this.header({MinPri: 3}) + 'FF' + decToHex(Ext_OPC, 2) + 
                            decToHex(byte1, 2) + 
                            decToHex(byte2, 2) + 
                            decToHex(byte3, 2) + 
                            decToHex(byte4, 2) + 
                            decToHex(byte5, 2) + 
                            decToHex(byte6, 2) + ';';
    }


}

module.exports = new cbusLibrary();



