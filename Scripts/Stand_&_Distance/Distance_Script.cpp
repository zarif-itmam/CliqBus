#include<iostream>
#include<fstream>
#include<vector>
using namespace std;

ifstream in1("./Stand_In.txt");
ofstream out1("./Stand_Script.txt");
ifstream in2("./Distance_In.txt");
ofstream out2("./Distance_Script.txt");

int main(){
    if(!out1){
        cout<<"Cannot open file.\n";
    }
    if(!in1){
        cout<<"Cannot open file.\n";
    }
    if(!out2){
        cout<<"Cannot open file.\n";
    }
    if(!in2){
        cout<<"Cannot open file.\n";
    }
    vector<string> districts;
    while(in1){
        string str;
        getline(in1,str);
        if(str==""){
            break;
        }
        districts.push_back(str);
        out1<<"INSERT INTO STAND VALUES(SEQ_STAND.NEXTVAL,'"<<str<<"');"<<endl;
    }
    int curr=1;
    while(in2){
        string str;
        in2>>str;
        if(str==""){
            break;
        }
        string str2="";
        string str3=" ";
        if(str=="Cox's"){
            in2>>str2;
        }
        string district=str.append(str2==""?"":str3.append(str2));
        vector<int> distances(64);
        for(int i=0;i<64;i++){
            in2>>distances[i];
        }
        for(int i=0;i<64;i++){
            if(curr!=i+1){
                out2<<"INSERT INTO DISTANCE VALUES(SEQ_DISTANCE.NEXTVAL,"<<curr<<","<<i+1<<","<<distances[i]<<");"<<endl;
            }
        }
        curr++;
    }
}