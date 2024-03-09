import java.io.*;

public class User_Script{
    public static void main(String[] args) throws Exception{
        Reader fr = new FileReader("./info.txt");
        BufferedReader br = new BufferedReader(fr);
        FileWriter fw = new FileWriter("./User_Script.txt");
        BufferedWriter bw = new BufferedWriter(fw);
        while (true) {
            String s = br.readLine();
            if (s == null)
                break;
            String[] str=s.split(",");
            System.out.println(str.length);
            if(str.length>4){
                String str4=str[3];
                for(int i=4;i<str.length;i++){
                    str4=str4+str[i];
                }
                str[3]=str4;
            }
            String str1="";
            for(int i=0;i<str[0].length();i++){
                if(str[0].charAt(i)==39 || str[0].charAt(i)==34){
                }
                else{
                    str1=str1+str[0].charAt(i);
                }
            }
            str[0]=str1;
            String insertStatement="INSERT INTO USER_ACCOUNT VALUES(SEQ_USER.NEXTVAL,'"+str[0]+"',ORA_HASH('"+str[3]+"',32),'"+str[1]+"','"+str[2]+"',SYSDATE,SYSDATE);";
            bw.write(insertStatement);
            bw.newLine();
        }
        bw.close();
        fw.close();
        br.close();
        fr.close();
    }
}