import OpenAI from "openai";

export const PLUGIN_REGISTRY = [
  {
    id: "filesystem",
    name: "Filesystem Plugin",
    description: "로컬 파일 및 디렉토리 접근 권한 (읽기, 쓰기, 삭제)",
    tools: [
      {
        type: "function",
        function: {
          name: "list_directory",
          description: "주어진 경로의 폴더 및 파일 목록을 배열 형태로 반환합니다.",
          parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] }
        }
      },
      {
        type: "function",
        function: {
          name: "read_text_file",
          description: "주어진 경로의 텍스트 파일 내용을 읽습니다.",
          parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] }
        }
      },
      {
        type: "function",
        function: {
          name: "write_text_file",
          description: "지정된 경로에 텍스트 파일을 생성하거나 내용을 덮어씁니다.",
          parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] }
        }
      },
      {
        type: "function",
        function: {
          name: "delete_path",
          description: "지정된 경로의 파일이나 폴더를 삭제합니다.",
          parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] }
        }
      },
      {
        type: "function",
        function: {
          name: "find_files",
          description: "주어진 폴더 및 하위 폴더 전체에서 특정 이름이나 확장자를 가진 파일을 검색합니다.",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string", description: "검색을 시작할 최상위 폴더 경로 (예: 'C:\\Users\\username\\Documents' 또는 바탕화면 경로)" },
              query: { type: "string", description: "검색할 파일명 또는 확장자 (예: '보고서', '.pdf')" }
            },
            required: ["path", "query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "copy_path",
          description: "파일을 지정된 새로운 경로로 복사합니다. (주의: 원본 파일명과 새 파일명이 모두 경로에 포함되어야 함)",
          parameters: {
            type: "object",
            properties: {
              source: { type: "string", description: "원본 파일의 전체 경로" },
              destination: { type: "string", description: "복사될 새 파일의 전체 경로 (파일명 포함)" }
            },
            required: ["source", "destination"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "move_path",
          description: "파일이나 폴더를 새로운 경로로 이동시키거나 이름을 변경합니다.",
          parameters: {
            type: "object",
            properties: {
              source: { type: "string", description: "원본 경로" },
              destination: { type: "string", description: "이동될 새 경로 (파일명 포함)" }
            },
            required: ["source", "destination"]
          }
        }
      }
    ] as OpenAI.Chat.ChatCompletionTool[]
  },
  {
    id: "application",
    name: "Applications Plugin",
    description: "데스크탑에 설치된 프로그램 검색 및 실행",
    tools: [
      {
        type: "function",
        function: {
          name: "open_application",
          description: "주어진 이름이나 경로의 앱을 실행합니다. 특정 파일이나 URL을 함께 열어야 할 경우 인수를 추가할 수 있습니다.",
          parameters: { 
            type: "object", 
            properties: { 
              app_name: { type: "string", description: "실행할 앱의 이름 또는 절대 경로 (예: 'chrome', 'notepad', 'C:\\...\\app.exe')" },
              args: { 
                type: "array", 
                items: { type: "string" }, 
                description: "앱에 전달할 인수 목록 (예: 열고자 하는 파일의 경로, 접속할 URL 등) - 필요 없으면 생략 가능" 
              }
            }, 
            required: ["app_name"] 
          }
        }
      },
      {
        type: "function",
        function: {
          name: "find_application",
          description: "앱의 실행 경로(.lnk)를 시작 메뉴에서 검색합니다.",
          parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] }
        }
      },
      {
        type: "function",
        function: {
          name: "kill_process",
          description: "실행 중인 프로그램을 강제로 종료합니다. 여러 창이 켜져 있다면 모두 닫습니다. (예: 'chrome', 'notepad', '계산기')",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "종료할 프로그램의 영어 또는 한글 이름 (예: 'notepad', 'chrome', 'kakao')" }
            },
            required: ["name"]
          }
        }
      },
    ] as OpenAI.Chat.ChatCompletionTool[]
  },
  {
    id: "system_info",
    name: "System Info Plugin",
    description: "컴퓨터 운영체제, CPU, 메모리 상태 확인",
    tools: [
      {
        type: "function",
        function: {
          name: "get_system_info",
          description: "현재 컴퓨터의 시스템 상태를 확인합니다.",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function",
        function: {
          name: "get_realtime_system_info",
          description: "현재 컴퓨터의 실시간 CPU 사용률, 메모리(RAM) 사용량, 디스크(C드라이브 등) 전체 및 남은 용량 상태를 확인합니다.",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function",
        function: {
          name: "get_network_info",
          description: "현재 컴퓨터의 인터넷 연결 상태(온라인/오프라인)와 로컬 IP 주소(IPv4)를 확인합니다.",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function",
        function: {
          name: "get_battery_info",
          description: "현재 컴퓨터의 배터리 잔량(%) 및 전원 케이블 연결 상태(충전 중 여부)를 확인합니다. 데스크탑인지 노트북인지 파악할 때도 유용합니다.",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function",
        function: {
          name: "control_system",
          description: "컴퓨터의 전원을 제어합니다 (시스템 종료, 재부팅, 절전 모드). 사용자가 명시적으로 요청할 때만 사용하세요.",
          parameters: {
            type: "object",
            properties: {
              action: { 
                type: "string", 
                enum: ["shutdown", "restart", "sleep"],
                description: "실행할 전원 제어 명령 (종료=shutdown, 재부팅=restart, 절전=sleep)" 
              }
            },
            required: ["action"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "control_audio",
          description: "컴퓨터의 마스터 볼륨을 제어합니다. 음소거하거나 볼륨을 올리고 내릴 수 있습니다.",
          parameters: {
            type: "object",
            properties: {
              action: { 
                type: "string", 
                enum: ["mute", "up", "down"],
                description: "실행할 오디오 명령 (음소거 토글=mute, 볼륨 올리기=up, 볼륨 내리기=down)" 
              }
            },
            required: ["action"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_display_info",
          description: "컴퓨터에 연결된 모니터의 개수, 각각의 해상도(픽셀: width x height), 주 모니터 여부, 배율 등의 디스플레이 환경을 확인합니다. 화면 캡처 후 클릭 좌표를 계산할 때 전체 화면 크기를 파악하는 데 유용합니다.",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function",
        function: {
          name: "control_brightness",
          description: "컴퓨터 화면(주로 노트북 내장 디스플레이)의 밝기를 확인하거나 조절합니다.",
          parameters: {
            type: "object",
            properties: {
              action: { 
                type: "string", 
                enum: ["get", "set", "up", "down"],
                description: "명령 (현재 밝기 확인=get, 특정 값으로 설정=set, 10% 올리기=up, 10% 내리기=down)" 
              },
              level: {
                type: "integer",
                description: "action이 'set'일 때 설정할 밝기 퍼센트 (0~100)"
              }
            },
            required: ["action"]
          }
        }
      },
    ] as OpenAI.Chat.ChatCompletionTool[]
  },
  {
    id: "browser",
    name: "Browser Plugin (Web Search)",
    description: "인터넷 웹 검색 및 웹페이지 직접 열기/읽기",
    tools: [
      {
        type: "function",
        function: {
          name: "web_search",
          description: "인터넷 검색이 필요할 때 웹 검색을 수행합니다.",
          parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
        }
      },
      {
        type: "function",
        function: {
          name: "open_url",
          description: "사용자의 기본 브라우저를 띄워서 특정 URL 화면을 직접 열어줍니다.",
          parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] }
        }
      },
      {
        type: "function",
        function: {
          name: "read_webpage",
          description: "특정 웹페이지(URL) 안으로 들어가 본문 텍스트 전체를 읽어옵니다. 검색 결과의 상세 내용을 파악하거나 기사, 블로그 내용을 요약할 때 사용하세요.",
          parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] }
        }
      }
    ] as OpenAI.Chat.ChatCompletionTool[]
  },
  {
    id: "desktop_control",
    name: "Desktop Control Plugin",
    description: "마우스 커서 이동 및 클릭, 키보드 타이핑 물리적 제어",
    tools: [
      {
        type: "function",
        function: {
          name: "move_mouse_and_click",
          description: "마우스를 특정 화면 좌표(x, y)로 이동한 후 왼쪽 버튼을 클릭합니다.",
          parameters: {
            type: "object",
            properties: {
              x: { type: "integer", description: "X 좌표 (예: 500)" },
              y: { type: "integer", description: "Y 좌표 (예: 300)" }
            },
            required: ["x", "y"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "type_text",
          description: "현재 활성화된 창에 텍스트를 키보드로 타이핑합니다.",
          parameters: {
            type: "object",
            properties: {
              text: { type: "string", description: "입력할 텍스트" }
            },
            required: ["text"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "take_screenshot",
          description: "현재 컴퓨터의 화면 전체를 캡처하여 이미지로 반환합니다. 화면에서 특정 아이콘이나 버튼의 위치(좌표)를 찾거나 현재 상태를 확인할 때 사용하세요.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "read_clipboard",
          description: "현재 컴퓨터 클립보드에 복사되어 있는 텍스트를 읽어옵니다.",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function",
        function: {
          name: "write_clipboard",
          description: "지정된 텍스트를 컴퓨터의 클립보드에 복사합니다. 사용자가 나중에 Ctrl+V로 붙여넣을 수 있게 됩니다.",
          parameters: {
            type: "object",
            properties: {
              text: { type: "string", description: "클립보드에 복사할 텍스트 내용" }
            },
            required: ["text"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_active_window_info",
          description: "현재 컴퓨터 화면에서 사용자가 가장 맨 위에서 보고 있는(포커스된) 창의 프로그램 이름과 제목을 확인합니다. 사용자가 '지금 내가 보고 있는 창' 등을 언급할 때 사용하세요.",
          parameters: { type: "object", properties: {}, required: [] }
        }
      }
    ] as OpenAI.Chat.ChatCompletionTool[]
  }
];