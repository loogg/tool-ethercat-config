import { basicApplicationExample, singleModuleExample } from './application-basic-example.js'
// Generic application examples. The modular source workbook remains read-only.
// Blank values remain null; generated ESI/PDO data is not asserted.
export const applicationWorkbooks = [
  basicApplicationExample,
  singleModuleExample,
  {
    "id": "mdp-io",
    "title": "模块化应用 · I/O 示例",
    "filename": "SSC_MDP_Base_Modules_Example.xlsx",
    "sheets": [
      {
        "id": "Base_Device",
        "name": "Base_Device",
        "role": "base",
        "metadata": [
          {
            "name": "Device Profile",
            "value": 5001,
            "cell": "C1"
          },
          {
            "name": "Modul Profile",
            "value": "0",
            "cell": "C2"
          },
          {
            "name": "IndexIncrement",
            "value": "0x10",
            "cell": "C3"
          },
          {
            "name": "PdoIndexIncrement",
            "value": "0x1",
            "cell": "C4"
          }
        ],
        "rows": [
          {
            "number": 12,
            "kind": "object",
            "values": {
              "B": "0xF000",
              "C": "RECORD",
              "D": null,
              "E": null,
              "F": "Modular Device Profile",
              "G": null,
              "H": null,
              "I": null,
              "J": "M",
              "K": null,
              "L": "ro",
              "M": null,
              "N": null,
              "O": null,
              "P": "Device-level MDP information; SI0 is read-only."
            }
          },
          {
            "number": 13,
            "kind": "member",
            "values": {
              "B": null,
              "C": null,
              "D": 1,
              "E": "UINT16",
              "F": "Index distance",
              "G": "0x10",
              "H": null,
              "I": null,
              "J": "M",
              "K": null,
              "L": "ro",
              "M": null,
              "N": null,
              "O": null,
              "P": "Module object index distance: 0x10."
            }
          },
          {
            "number": 14,
            "kind": "member",
            "values": {
              "B": null,
              "C": null,
              "D": 2,
              "E": "UINT16",
              "F": "Maximum number of modules",
              "G": 2,
              "H": null,
              "I": null,
              "J": "M",
              "K": null,
              "L": "ro",
              "M": null,
              "N": null,
              "O": null,
              "P": "Maximum module instances: 2."
            }
          },
          {
            "number": 16,
            "kind": "object",
            "values": {
              "B": "0xF030",
              "C": "ARRAY",
              "D": null,
              "E": null,
              "F": "Configured Module Ident List",
              "G": null,
              "H": null,
              "I": null,
              "J": null,
              "K": null,
              "L": "rw",
              "M": null,
              "N": null,
              "O": null,
              "P": "Writable SI0; DownloadModuleIdentList=true. Validate downloads in firmware."
            }
          },
          {
            "number": 17,
            "kind": "member",
            "values": {
              "B": null,
              "C": null,
              "D": 1,
              "E": "UINT32",
              "F": null,
              "G": "0x4711",
              "H": null,
              "I": null,
              "J": null,
              "K": null,
              "L": "rw",
              "M": null,
              "N": null,
              "O": null,
              "P": "[Slotname: Input Slot] [ModuleIds: 0x4711]"
            }
          },
          {
            "number": 18,
            "kind": "member",
            "values": {
              "B": null,
              "C": null,
              "D": 2,
              "E": "UINT32",
              "F": null,
              "G": "0x4712",
              "H": null,
              "I": null,
              "J": null,
              "K": null,
              "L": "rw",
              "M": null,
              "N": null,
              "O": null,
              "P": "[Slotname: Output Slot] [ModuleIds: 0x4712]"
            }
          }
        ]
      },
      {
        "id": "Digital_Input",
        "name": "Digital_Input",
        "role": "module",
        "metadata": [
          {
            "name": "Device Profile",
            "value": 5001,
            "cell": "C1"
          },
          {
            "name": "Modul Profile",
            "value": "0",
            "cell": "C2"
          },
          {
            "name": "Module Ident",
            "value": "0x4711",
            "cell": "C3"
          },
          {
            "name": "IndexIncrement",
            "value": "0x10",
            "cell": "C4"
          },
          {
            "name": "PdoIndexIncrement",
            "value": "0x1",
            "cell": "C5"
          }
        ],
        "rows": [
          {
            "number": 12,
            "kind": "object",
            "values": {
              "B": "0x6000",
              "C": "RECORD",
              "D": null,
              "E": null,
              "F": "Inputs",
              "G": null,
              "H": null,
              "I": null,
              "J": null,
              "K": null,
              "L": "ro",
              "M": null,
              "N": null,
              "O": null,
              "P": "Input module template; read-only SI0."
            }
          },
          {
            "number": 13,
            "kind": "member",
            "values": {
              "B": null,
              "C": null,
              "D": 1,
              "E": "BOOL",
              "F": "SWITCH1",
              "G": "FALSE",
              "H": null,
              "I": null,
              "J": "M",
              "K": null,
              "L": "ro",
              "M": "tx",
              "N": null,
              "O": null,
              "P": "Digital input 1; updated by the application."
            }
          },
          {
            "number": 14,
            "kind": "member",
            "values": {
              "B": null,
              "C": null,
              "D": 2,
              "E": "BOOL",
              "F": "SWITCH2",
              "G": "FALSE",
              "H": null,
              "I": null,
              "J": "M",
              "K": null,
              "L": "ro",
              "M": "tx",
              "N": null,
              "O": null,
              "P": "Digital input 2; updated by the application."
            }
          }
        ]
      },
      {
        "id": "Digital_Output",
        "name": "Digital_Output",
        "role": "module",
        "metadata": [
          {
            "name": "Device Profile",
            "value": 5001,
            "cell": "C1"
          },
          {
            "name": "Modul Profile",
            "value": "0",
            "cell": "C2"
          },
          {
            "name": "Module Ident",
            "value": "0x4712",
            "cell": "C3"
          },
          {
            "name": "IndexIncrement",
            "value": "0x10",
            "cell": "C4"
          },
          {
            "name": "PdoIndexIncrement",
            "value": "0x1",
            "cell": "C5"
          }
        ],
        "rows": [
          {
            "number": 12,
            "kind": "object",
            "values": {
              "B": "0x7000",
              "C": "RECORD",
              "D": null,
              "E": null,
              "F": "Outputs",
              "G": null,
              "H": null,
              "I": null,
              "J": null,
              "K": null,
              "L": "ro",
              "M": null,
              "N": null,
              "O": null,
              "P": "Output module template; read-only SI0. Slot 1 produces index 0x7010."
            }
          },
          {
            "number": 13,
            "kind": "member",
            "values": {
              "B": null,
              "C": null,
              "D": 1,
              "E": "BOOL",
              "F": "LED1",
              "G": "FALSE",
              "H": null,
              "I": null,
              "J": "M",
              "K": null,
              "L": "rw",
              "M": "rx",
              "N": null,
              "O": null,
              "P": "Digital output 1; applied by the application."
            }
          },
          {
            "number": 14,
            "kind": "member",
            "values": {
              "B": null,
              "C": null,
              "D": 2,
              "E": "BOOL",
              "F": "LED2",
              "G": "FALSE",
              "H": null,
              "I": null,
              "J": "M",
              "K": null,
              "L": "rw",
              "M": "rx",
              "N": null,
              "O": null,
              "P": "Digital output 2; applied by the application."
            }
          }
        ]
      }
    ]
  }
]
